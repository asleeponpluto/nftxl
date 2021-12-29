const Moralis = require('moralis/node');
const currency = require('currency.js');
const clone = require('just-clone');

const util = require('./util');

async function queryCurrentNFTs(inputWallets) {
    let allNFTsArr = [];

    for (let wallet of inputWallets) {
        let page = 0;

        while (true) {
            const userEthNFTs = await util.retryIfError(async () => {
                return await Moralis.Web3API.account.getNFTs({
                    address: wallet,
                    offset: page * 500,
                    limit: 500
                });
            });

            if (userEthNFTs.result.length === 0)
                break;

            allNFTsArr = allNFTsArr.concat(userEthNFTs.result);

            page++;
            console.log(`${userEthNFTs.result.length} items queried...`);
            await util.timeout(2000);
        }
    }

    return allNFTsArr;
}

function filterTransactionsByCurrentNFTs(processedTransactions, currentNFTs) {
    // key: 'token_address:token_id' value: array of transactions for that nft
    const nftTxnArrMap = new Map();
    // key: 'token_address:token_id' value: highest priority transaction for that nft
    const finalNftTxnMap = new Map();

    // match NFTs to transactions
    for (let nft of currentNFTs) {
        const currKey = nft.contract_type === 'ERC1155'
                ? `${nft.token_address}:${nft.token_id}:${nft.owner_of}`
                : `${nft.token_address}:${nft.token_id}`;
        // if (nftTxnArrMap.has(currKey)) {
        //     console.log(currKey);
        //     console.log(nft.owner_of);
        //     console.log(nftTxnArrMap.get(currKey));
        //     throw new Error("duplicate NFTs in multiple wallets (shouldn't happen)");
        // }
        nftTxnArrMap.set(currKey, []);
        for (let txn of processedTransactions) {
            if (txn.walletAddress === nft.owner_of && txn.tokenAddress === nft.token_address && txn.tokenIDArr.includes(nft.token_id)) {
                if (txn.actionType === 'mint' || txn.actionType === 'buy' || txn.actionType === 'transfer (in)' || txn.actionType === 'airdrop') {
                    // Modify txn to include info from currentNFTs
                    nftTxnArrMap.get(currKey).push(txn);
                }
            }
        }

        nftTxnArrMap.get(currKey).unshift(nft);
    }

    // sort all txn arrays for each nft by date
    for (let [nftKey, txnArr] of nftTxnArrMap) {
        txnArr.sort((a, b) => {
            // should sort all dates from new to old
            return b.date - a.date;
        });
    }

    // use priority order: mint, buy, transfer (in), airdrop
    // to decide which txn to use
    for (let [nftKey, txnArr] of nftTxnArrMap) {
        let hasMint = false;
        let hasBuy = false;
        let hasTransferIn = false;
        let hasAirdrop = false;
        let finalActionType;
        let finalTxn;

        const nftTxn = txnArr.shift();

        // Initiate ERC1155 array if needed
        if(nftTxn.contract_type === "ERC1155"){
            finalTxn = [...new Array(parseInt(nftTxn.amount)).fill(null)];
        }

        for (let txn of txnArr) {
            if(nftTxn.contract_type !== "ERC1155"){
                if (txn.actionType === 'mint')
                    hasMint = true;
                else if (txn.actionType === 'buy')
                    hasBuy = true;
                else if (txn.actionType === 'transfer (in)')
                    hasTransferIn = true;
                else if (txn.actionType === 'airdrop')
                    hasAirdrop = true;
            }
        }

        if(nftTxn.contract_type !== "ERC1155") {
            if (hasMint)
                finalActionType = 'mint';
            else if (hasBuy)
                finalActionType = 'buy';
            else if (hasTransferIn)
                finalActionType = 'transfer (in)';
            else if (hasAirdrop)
                finalActionType = 'airdrop';
        }

        // Priority calculator anon function
        const calculatePriority = (action) => {
            if(action.toLowerCase() === "mint"){
                return 4;
            }
            if(action.toLowerCase() === "buy"){
                return 3;
            }
            if(action.toLowerCase() === "transfer (in)"){
                return 2;
            }
            if(action.toLowerCase() === "airdrop"){
                return 1;
            }
        }

        for (let txn of txnArr) {
            if(nftTxn.contract_type === "ERC1155") {
                // Loop through array and fill out nulls

                // Next, determine the maximum amount of transactions we are allowed to replace
                let amountToReplace = txn.quantity;
                for(let i = 0; i < finalTxn.length; i++){
                    const newFinal = finalTxn[i];
                    // If it's null, replace and decrease amount
                    if(newFinal == null){
                        finalTxn[i] = txn;
                        if(amountToReplace - 1 === 0){
                            break;
                        }
                    }else if(calculatePriority(txn.actionType) > calculatePriority(finalTxn[i].actionType)){
                        finalTxn[i] = txn;
                        if(amountToReplace - 1 === 0){
                            break;
                        }
                    }
                }
            }else{
                if (txn.actionType === finalActionType) {
                    // create deep copy of txn (very important!)
                    finalTxn = clone(txn);
                    break;
                }
            }
        }

        if(nftTxn.contract_type === "ERC1155"){
            // Now we sort by date
            for(let txn of txnArr){
                for(let i = 0; i < finalTxn.length; i++){
                    const tx = finalTxn[i];
                    if(txn.actionType === tx.actionType){
                        finalTxn[i] = tx;
                    }
                }
            }
        }

        // divide prices for transactions with a >1 quantity
        // also fix tokenID for specific transaction
        if (finalTxn == null) {
            console.log(nftKey);
            console.log(txnArr);
            throw new Error('no transactions were found for a specific nft');
        }

        if(nftTxn.contract_type === "ERC1155"){
            for(let finalTx of finalTxn) {
                if (finalTx.quantity > 1) {
                    const divFactor = finalTx.quantity;

                    // eth
                    finalTx.ethValuePreFee /= divFactor;
                    finalTx.ethGasFee /= divFactor;
                    finalTx.ethMarketplaceFee /= divFactor;
                    finalTx.ethValuePostFee /= divFactor;

                    // usd
                    finalTx.fiatValuePreFee = currency(finalTx.fiatValuePreFee).divide(divFactor).value;
                    finalTx.fiatGasFee = currency(finalTx.fiatGasFee).divide(divFactor).value;
                    finalTx.fiatMarketplaceFee = currency(finalTx.fiatMarketplaceFee).divide(divFactor).value;
                    finalTx.fiatValuePostFee = currency(finalTx.fiatValuePostFee).divide(divFactor).value;

                    // fix tokenID
                    finalTx.tokenID = nftKey.split(':')[1];

                    // erc-1155 fixes
                    finalTx.quantity = 1;
                }
            }
        }else{
            if (finalTxn.quantity > 1) {
                const divFactor = finalTxn.quantity;

                // eth
                finalTxn.ethValuePreFee /= divFactor;
                finalTxn.ethGasFee /= divFactor;
                finalTxn.ethMarketplaceFee /= divFactor;
                finalTxn.ethValuePostFee /= divFactor;

                // usd
                finalTxn.fiatValuePreFee = currency(finalTxn.fiatValuePreFee).divide(divFactor).value;
                finalTxn.fiatGasFee = currency(finalTxn.fiatGasFee).divide(divFactor).value;
                finalTxn.fiatMarketplaceFee = currency(finalTxn.fiatMarketplaceFee).divide(divFactor).value;
                finalTxn.fiatValuePostFee = currency(finalTxn.fiatValuePostFee).divide(divFactor).value;

                // fix tokenID
                finalTxn.tokenID = nftKey.split(':')[1];
            }
        }

        finalNftTxnMap.set(nftKey, finalTxn);
    }

    return finalNftTxnMap;
}

exports.queryCurrentNFTs = queryCurrentNFTs;
exports.filterTransactionsByCurrentNFTs = filterTransactionsByCurrentNFTs;