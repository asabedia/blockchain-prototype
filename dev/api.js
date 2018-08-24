const express = require('express');
const bodyparser = require('body-parser');
const UUID = require('uuid/v1');
const requestPromise = require('request-promise');
const server = express();
const Blockchain = require('./blockchain');

const port = process.argv[2];
const nodeAddress = UUID().split('-').join('');

const chain = new Blockchain();

server.use(bodyparser.json());
server.use(bodyparser.urlencoded({extended: false}));

server.get('/blockchain', function(req, res){
    res.send(chain);
});

server.post('/new/broadcast-transaction', function(req,res){
    const newTransaction = chain.newTransaction(req.body.amount, req.body.sender, req.body.recipient);
    chain.pushTransaction(newTransaction);

    const reqPromises = [];
    chain.networkNodes.forEach(url => {
        const reqOptions = {
            uri: url + '/new/transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        };
        reqPromises.push(requestPromise(reqOptions));
    });
    Promise.all(reqPromises)
    .then(data => {
        res.json({note: "Transaction added and synced."});
    });
});

server.post('/new/transaction', function(req, res){
    const newTransaction = req.body;
    const blockIndex = chain.pushTransaction(newTransaction);
    res.json({note: 'Transaction will be added to block ${blockIndex}.'});
});

server.get('/mine', function(req, res){
    const lastBlock = chain.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = {
        transactions: chain.pendingTransactions,
        blockIndex: lastBlock['index'] + 1
    }
    const nonce = chain.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = chain.hashBlock(previousBlockHash, currentBlockData, nonce);


    const newBlock = chain.createNewBlock(nonce, previousBlockHash, blockHash);

    const reqPromises = []
    chain.networkNodes.forEach(url => {
        const reqOptions = {
            uri: url + '/new/block',
            method: 'POST',
            body: {newBlock: newBlock},
            json: true
        };
        reqPromises.push(requestPromise(reqOptions));
    });

    Promise.all(reqPromises)
    .then(data => {
        const reqOptions = {
            uri: chain.nodeUrl + '/new/broadcast-transaction',
            method: 'POST',
            body: {
                amount: 12.5,
                sender: '00',
                recipient: nodeAddress
            },
            json: true
        };
        return requestPromise(reqOptions);
    })
    .then(data => {
        res.json({
            note: "New block mined and synced successfully!",
            block: newBlock
        });
    });
});

server.post('/new/block', function(req,res){
    const newBlock = req.body.newBlock;
    const lastBlock = chain.getLastBlock();
    const  correctHash = (lastBlock.hash === newBlock.previousBlockHash);
    const correctIndex = newBlock['index'] === lastBlock['index'] + 1;
    if(correctHash && correctIndex){
        //valid block
        chain.chain.push(newBlock);
        chain.pendingTransactions = [];
        res.json({note: "New block received and accepted.", newBlock: newBlock});
    }else{
        res.json({note: "New block received and rejected.", newBlock: newBlock});
    }
});

//register node and broadcast
server.post('/new/broadcast-node', function(req, res){
    const newNodeUrl = req.body.newNodeUrl;
    if(chain.networkNodes.indexOf(newNodeUrl) == -1) chain.networkNodes.push(newNodeUrl);

    //broadcast
    const registrationPromises = [];
    chain.networkNodes.forEach(url => {
        //'/new/node'
        const requestOptions = {
            uri: url + '/new/node',
            method: 'POST',
            body: {newNodeUrl: newNodeUrl},
            json: true
        };
        registrationPromises.push(requestPromise(requestOptions));
    });

    Promise.all(registrationPromises)
    .then(data => {
        const bulkRegistrationOptions = {
            uri: newNodeUrl + "/new/nodes",
            method: 'POST',
            body: {allNetworkNodes: [...chain.networkNodes]},
            json: true
        }
        return requestPromise(bulkRegistrationOptions);
    }).then(data => {
        res.json({note: "node registration completed"});
    });
});

//register node
server.post('/new/node', function(req, res){
    const newNodeUrl = req.body.newNodeUrl;
    if(chain.networkNodes.indexOf(newNodeUrl) == -1 && chain.nodeUrl !== newNodeUrl) chain.networkNodes.push(newNodeUrl);
    res.json({note: "node registration completed"});
});

//register multiple nodes at once 
server.post('/new/nodes', function(req,res){
    const allNodes =  req.body.allNetworkNodes;
    allNetworkNodes.forEach(url => {
        if(chain.networkNodes.indexOf(url) == -1 && chain.nodeUrl !== url) chain.networkNodes.push(url);
    })
    res.json({note: "node registration completed"});
});

//should be called when new block is added (Longest chain rule)
server.get('/consensus', function(req, res){
    const reqPromises = [];
    chain.networkNodes.forEach(url => {
        const requestOptions = {
            uri: url + '/blockchain',
            method: 'GET',
            json: true
        };
        reqPromises.push(requestPromise(requestOptions));
    });

    Promise.all(reqPromises)
    .then(blockchains => {
        const currentChainLength = chain.chain.length;
        let maxChainLength = currentChainLength;
        let newLongestChain = null;
        let newPendingTransactions = null;
        blockchains.forEach(blockchain => {
            let length = blockchain.chain.length
            if( length > maxChainLength){
                maxChainLength = length;
                newLongestChain = blockchain.chain;
                newPendingTransactions = blockchain.pendingTransactions;
            }
        });

        if(!newLongestChain || (newLongestChain && !chain.chainIsValid(newLongestChain))){
            res.json({
                note: "Current chain has not been replaced.",
                chain: chain.chain
            });
        }else{
            chain.chain = newLongestChain;
            chain.pendingTransactions = newPendingTransactions;
            res.json({
                note: "Current chain has been replaced.",
                chain: chain.chain
            });
        }
    });
});

server.get('/block/:blockHash', function(req, res){
    const blockHash = req.params.blockHash;
    const block = chain.getBlock(blockHash);
    res.json({block: block});
});

server.get('/transaction/:transactionId', function(req, res){
    const transactionId = req.params.transactionId;
    const result = chain.getTransactionAndBlock(transactionId);
    res.json({block: result.block, transaction: result.transaction});
});

server.get('/address/:address', function(req, res){
    const address = req.params.address;
    const result = chain.getAddressData(address);
    res.json({addressTransaction: result.addressTransactions, addressBalance: result.addressBalance});
});

server.listen(port, function(err){
    if(err){
        console.log(err);
    }else {
        console.log("Server Started. Port: " + port);
    }
});