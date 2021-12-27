const Moralis = require('moralis/node');
const { timeout } = require('./util');

async function queryCurrentNFTs(inputWallets) {
    let allNFTsArr = [];

    for (let wallet of inputWallets) {
        let page = 0;

        while (true) {
            const userEthNFTs = await Moralis.Web3API.account.getNFTs({
                address: wallet,
                offset: page * 500,
                limit: 500
            });

            if (userEthNFTs.result.length === 0)
                break;

            allNFTsArr = allNFTsArr.concat(userEthNFTs.result);

            page++;
            await timeout(2000);
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
        const currKey = `${nft.token_address}:${nft.token_id}`;
        if (nftTxnArrMap.has(currKey)) throw new Error("duplicate NFTs in multiple wallets (shouldn't happen)");
        nftTxnArrMap.set(currKey, []);
        for (let txn of processedTransactions) {
            if (txn.walletAddress === nft.owner_of && txn.tokenAddress === nft.token_address && txn.tokenID === nft.token_id) {
                if (txn.actionType === 'mint' || txn.actionType === 'buy' || txn.actionType === 'transfer (in)' || txn.actionType === 'airdrop') {
                    nftTxnArrMap.get(currKey).push(txn);
                }
            }
        }
    }

    console.log(nftTxnArrMap)

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

        for (let txn of txnArr) {
            if (txn.actionType === 'mint')
                hasMint = true;
            else if (txn.actionType === 'buy')
                hasBuy = true;
            else if (txn.actionType === 'transfer (in)')
                hasTransferIn = true;
            else if (txn.actionType === 'airdrop')
                hasAirdrop = true;
        }

        if (hasMint)
            finalActionType = 'mint';
        else if (hasBuy)
            finalActionType = 'buy';
        else if (hasTransferIn)
            finalActionType = 'transfer (in)';
        else if (hasAirdrop)
            finalActionType = 'airdrop';

        for (let txn of txnArr) {
            if (txn.actionType === finalActionType) {
                finalTxn = txn;
                break;
            }
        }

        finalNftTxnMap.set(nftKey, finalTxn);
    }

    return finalNftTxnMap;
}

exports.queryCurrentNFTs = queryCurrentNFTs;
exports.filterTransactionsByCurrentNFTs = filterTransactionsByCurrentNFTs;