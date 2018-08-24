const sha256 = require('sha256');
const UUID = require('uuid/v1');
const nodeUrl = process.argv[3];

const genesis = {
    nonce: 100,
    previousBlockHash: '0',
    hash: '0'
};

function Blockchain() {
    this.chain = [];
    this.pendingTransactions = [];
    this.nodeUrl = nodeUrl;
    this.networkNodes = [];
    this.chain.push(this.createNewBlock(genesis.nonce, genesis.previousBlockHash, genesis.hash));
}

Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash){
    const newBlock = {
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: this.pendingTransactions,
        nonce: nonce,                           //proof of work
        hash: hash,
        previousBlockHash: previousBlockHash
    };
    
    this.pendingTransactions = [];      //clear pending transactions
    this.chain.push(newBlock);

    return newBlock;
}

Blockchain.prototype.getLastBlock = function(){
    return this.chain[this.chain.length -1];
}

Blockchain.prototype.newTransaction = function(amount,sender,recipient){
     const newTransaction = {
        transactionId: UUID(),
        amount: amount,
        sender: sender,
        recipient: recipient
     };
     return newTransaction;
}

Blockchain.prototype.pushTransaction = function(transaction){
    this.pendingTransactions.push(transaction);
    return this.getLastBlock['index'] + 1;
};

Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce){
    const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);       //stringify
    const hash = sha256(dataAsString); 
    return hash;
}

Blockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData){
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    while(hash.substring(0,4) !== '0000'){
        nonce++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }
    return nonce;
}

Blockchain.prototype.chainIsValid = function(blockchain){
    //valid if prev hash && hash line up
    let isValid = true;
    for(var i = 1; i<blockchain.length;i++){
        const currentBlock = blockchain[i];
        const prevBlock = blockchain[i-1];
        const blockHash = this.hashBlock(prevBlock['hash'], {transactions: currentBlock['transactions'], index: currentBlock['index']}, currentBlock['nonce']);
        isValid = currentBlock['previousBlockHash'] === prevBlock['hash'];
        isValid = blockHash.substring(0,4) === '0000';
    }

    const genesisBlock = blockchain[0];
    const correctNonce = genesisBlock['nonce'] === genesis.nonce;
    const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === genesis.previousBlockHash;
    const correctHash = genesisBlock['hash'] === genesis.hash;
    const noTransactions = genesisBlock['transactions'].length === 0;

    isValid = correctNonce && correctPreviousBlockHash && correctHash && noTransactions;

    return isValid;
}

Blockchain.prototype.getBlock = function(blockHash){
    let matchingBlock = null;
    this.chain.forEach(block => {
        if(block['hash'] === blockHash) matchingBlock = block;
    });
    return matchingBlock;
}

Blockchain.prototype.getTransactionAndBlock = function(transactionId){
    let matchingTransaction= null;
    let matchingBlock = null;
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if(transaction['transactionId'] === transactionId){
                matchingTransaction = transaction;
                matchingBlock = block;
            };
        });
    });
    return {block: matchingBlock, transaction: matchingTransaction};
}

Blockchain.prototype.getAddressData = function(address){
    const addressTransactions = [];
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if(transaction.sender === address || transaction.recipient === address) addressTransactions.push(transaction);
        });
    });

    let balance = 0;
    addressTransactions.forEach(transaction => {
        if(transaction.recipient === address) balance += transaction.amount;
        else if(transaction.sender === address) balance -= transaction.amount;
    });

    return {
        addressTransactions: addressTransactions,
        addressBalance: balance
    };
}

module.exports = Blockchain;
