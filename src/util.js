const readline = require('readline');
const fs = require('fs');
const Moralis = require('moralis/node');
const fetch = require('node-fetch');
const currency = require('currency.js');
const Web3 = require('web3');
const web3 = new Web3();

function timeout(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

function promptAsync(message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((res, rej) => {
        rl.question(message, (answer) => {
            rl.close();
            res(answer);
        });
    });
}

// returns an array with all inputted addresses
async function getWalletsPrompt() {
    let lastInputted = '';
    let walletArr = [];

    while (true) {
        lastInputted = await promptAsync('Enter a wallet (blank to continue): ');

        if (lastInputted.trim().length === 0) break;
        else walletArr.push(lastInputted.toLowerCase());
    }

    return walletArr;
}

// returns an array with all read addresses
async function getWalletsFile(filePath) {
    const data = fs.readFileSync(filePath, {encoding: 'utf8'});
    const dirtyLines = data.toLowerCase().split(/[\r\n]+/);
    const cleaned = dirtyLines.filter((line) => line.trim().length !== 0);

    return cleaned;
}

async function getWallets() {
    if (process.argv.slice(2).length > 0) {
        return await getWalletsFile(process.argv[2]);
    }

    return await getWalletsPrompt();
}

async function queryMoralis(inputWallets) {
    let cleanTransactionArr = [];

    for (let address of inputWallets) {
        let page = 0;
        let dateReached = false;


        while (dateReached === false) {
            const transactions = await Moralis.Web3API.account.getNFTTransfers({
                address: address,
                offset: page * 500,
                limit: 500,
                // order: 'block_timestamp.DESC'
            });

            if (transactions.result.length === 0)
                break;

            const lastUnixTime = new Date(transactions.result[transactions.result.length - 1].block_timestamp);
            const time2021 = new Date (2021, 0, 1);

            if (lastUnixTime < time2021) {
                dateReached = true;
                let dirtyIndex;

                for (let i = 0; i < transactions.result.length; i++) {
                    const iterDate = new Date(transactions.result[i].block_timestamp);
                    if (iterDate < time2021) {
                        dirtyIndex = i;
                        break;
                    }
                }

                transactions.result.splice(dirtyIndex);
            }

            if (transactions.result.length !== 0) {
                cleanTransactionArr.push(transactions.result[0]);
                for (let i = 1; i < transactions.result.length; i++) {
                    if (transactions.result[i].transaction_hash !== transactions.result[i - 1].transaction_hash) {
                        cleanTransactionArr.push(transactions.result[i]);
                    }
                }
                // cleanTransactionArr = cleanTransactionArr.concat(transactions.result);
            } else {
                dateReached = true;
            }

            page++;
            console.log('500 items queried...');
            await timeout(2000);
        }
    }

    return cleanTransactionArr;
}

async function processTransactions(transactions, inputWallets) {
    let processedTransactions = [];
    const ethValueMap = new Map();
    const walletSet = new Set();

    for (let w of inputWallets) walletSet.add(w); // populate walletSet from inputWallets array (faster searching)

    for (let t of transactions) {
        // value of ether at transaction date
        let transactionDate = new Date(t.block_timestamp);
        let formattedDate = transactionDate.toISOString().split('T')[0];
        if (!ethValueMap.has(formattedDate)) {
            const result = await fetch(`https://api.coinbase.com/v2/prices/eth-usd/spot?date=${formattedDate}`);
            const resultJSON = await result.json();
            ethValueMap.set(formattedDate, resultJSON.data.amount);
            console.log('request to coinbase');
        } else {
            console.log('in map')
        }
        const ethPriceUSD = ethValueMap.get(formattedDate);

        // action type
        let actionType;
        if (t.from_address === '0x0000000000000000000000000000000000000000') {
            actionType = 'mint';
        } else if (walletSet.has(t.to_address)) {
            actionType = 'buy';
        } else if (walletSet.has(t.from_address)) {
            actionType = 'sell';
        } else {
            throw new Error('check action type calculations');
        }

        if (walletSet.has(t.from_address) && walletSet.has(t.to_address)) {
            throw new Error('to and from fields both contain input wallets')
        }

        // ethvalue and fiat value
        const ethValue = parseFloat(web3.utils.fromWei(t.value));
        const fiatValue = currency(ethPriceUSD).multiply(ethValue).value;

        // ethfee and fiat fee
        const txData = await Moralis.Web3API.native.getTransaction({transaction_hash: t.transaction_hash});
        const gasPriceEth = parseFloat(web3.utils.fromWei(txData.gas_price));
        const ethFee = gasPriceEth * txData.receipt_gas_used;
        const fiatFee = currency(ethPriceUSD).multiply(ethFee).value;

        // transaction data
        const nftMeta = await Moralis.Web3API.token.getNFTMetadata({address: t.token_address});
        const nftName = nftMeta.name;


        let tempObj = {
            txnHash: t.transaction_hash,
            date: new Date(t.block_timestamp),
            to: t.to_address,
            from: t.from_address,
            actionType: actionType,
            ethValue: ethValue,
            ethFee: ethFee,
            fiatValue: fiatValue,
            fiatFee: fiatFee,
            nftName: nftName
        }

        processedTransactions.push(tempObj);
        await timeout(100);
    }

    return processedTransactions;
}

exports.timeout = timeout;
exports.getWalletsPrompt = getWalletsPrompt;
exports.getWalletsFile = getWalletsFile;
exports.getWallets = getWallets;
exports.queryMoralis = queryMoralis;
exports.processTransactions = processTransactions;