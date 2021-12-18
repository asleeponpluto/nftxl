const readline = require('readline');
const fs = require('fs');
const Moralis = require('moralis/node');
const fetch = require('node-fetch');
const HttpsProxyAgent = require('https-proxy-agent');
const currency = require('currency.js');
const chalk = require('chalk');
const Web3 = require('web3');
const web3 = new Web3();

function timeout(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

async function retryIfError(someFunc) {
    while (true) {
        try {
            return await someFunc();
        } catch(e) {
            console.log('a function failed, waiting 10 seconds and trying again...')
            await timeout(10000);
        }
    }
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

    for (let wallet of inputWallets) {
        let page = 0;
        let dateReached = false;


        while (dateReached === false) {
            const transactions = await Moralis.Web3API.account.getNFTTransfers({
                address: wallet,
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
                for (let i = 0; i < transactions.result.length; i++) {
                    // TODO better duplicate checking (implement a set of all txHashes for fast searching)
                    if (cleanTransactionArr.length === 0 ||
                        transactions.result[i].transaction_hash !== cleanTransactionArr[cleanTransactionArr.length - 1].transaction_hash
                       ) {
                        cleanTransactionArr.push(transactions.result[i]);
                        cleanTransactionArr[cleanTransactionArr.length - 1].wallet = wallet;
                        cleanTransactionArr[cleanTransactionArr.length - 1].quantity = 1;
                    } else {
                        cleanTransactionArr[cleanTransactionArr.length - 1].quantity++;
                    }
                }
            } else {
                dateReached = true;
            }

            page++;
            console.log(`${transactions.result.length} items queried...`);
            await timeout(2000);
        }
    }

    return cleanTransactionArr;
}

async function processTransactions(transactions) {
    let processedTransactions = [];
    const ethValueMap = new Map();
    const marketFeeMap = new Map();
    let count = 1;

    for (let t of transactions) {
        process.stdout.write(chalk.red(`Transaction ${count++} of ${transactions.length}... `));

        // value of ether at transaction date
        let transactionDate = new Date(t.block_timestamp);
        let formattedDate = transactionDate.toISOString().split('T')[0];
        if (!ethValueMap.has(formattedDate)) {
            const result = await fetch(`https://api.coinbase.com/v2/prices/eth-usd/spot?date=${formattedDate}`);
            const resultJSON = await result.json();
            ethValueMap.set(formattedDate, resultJSON.data.amount);
            console.log(chalk.cyan('coinbase req'));
        } else {
            console.log(chalk.cyan('ethValue cached'));
        }
        const ethPriceUSD = ethValueMap.get(formattedDate);

        // action type
        let actionType;
        if (t.from_address === '0x0000000000000000000000000000000000000000') {
            actionType = 'mint';
        } else if (t.wallet.toLowerCase() === t.to_address.toLowerCase()) {
            actionType = 'buy';
        } else if (t.wallet.toLowerCase() === t.from_address.toLowerCase()) {
            actionType = 'sell';
        } else {
            throw new Error('check action type calculations');
        }

        // ethValue and fiatValue
        let ethValuePreFee = parseFloat(web3.utils.fromWei(t.value));
        let ethValuePostFee = ethValuePreFee;
        let fiatValuePreFee = currency(ethPriceUSD).multiply(ethValuePostFee).value;
        let fiatValuePostFee = fiatValuePreFee;
        let ethMarketplaceFee = 0;
        let fiatMarketplaceFee = 0;

        // ethFee and fiatFee
        console.log(`getTransaction: ${t.transaction_hash}`);
        const txData = await retryIfError(async () => {
            return await Moralis.Web3API.native.getTransaction({transaction_hash: t.transaction_hash});
        });
        const gasPriceEth = parseFloat(web3.utils.fromWei(txData.gas_price));
        const ethFee = gasPriceEth * txData.receipt_gas_used;
        const fiatFee = currency(ethPriceUSD).multiply(ethFee).value;

        // transaction data
        console.log(`getNFTMetadata: ${t.token_address}`);
        const nftMeta = await retryIfError(async () => {
            return await Moralis.Web3API.token.getNFTMetadata({address: t.token_address});
        });
        const nftName = nftMeta.name;

        // transfer (in), transfer (out), burn
        if (actionType === 'buy') {
            if (txData.to_address !== '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b' && t.value === '0')
                actionType = 'transfer (in)';
        } else if (actionType === 'sell') {
            if (txData.to_address !== '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b' && t.value === '0') {
                if (t.to_address === '0x0000000000000000000000000000000000000000')
                    actionType = 'burn';
                else
                    actionType = 'transfer (out)';
            }
        }

        // marketplace fee (must come after transfer (in), transfer (out), burn calculations)
        if (actionType === 'sell') {
            console.log(`getSellerPercentage: ${t.token_address}`);
            let sellerPercentage;
            if (marketFeeMap.has(t.token_address)) {
                sellerPercentage = marketFeeMap.get(t.token_address);
            } else {
                sellerPercentage = await retryIfError(async () => {
                    return await getSellerPercentage(t.token_address);
                });
                marketFeeMap.set(t.token_address, sellerPercentage);
            }
            const decimalPercentage = sellerPercentage / 10000;
            const multiplyFactor = 1 - decimalPercentage;
            ethMarketplaceFee = ethValuePostFee * decimalPercentage;
            fiatMarketplaceFee = currency(fiatValuePostFee).multiply(decimalPercentage).value;
            ethValuePostFee = ethValuePostFee * multiplyFactor;
            fiatValuePostFee = currency(fiatValuePostFee).multiply(multiplyFactor).value;
        }

        let tempObj = {
            date: new Date(t.block_timestamp),
            txnHash: t.transaction_hash,
            from: t.from_address,
            to: t.to_address,
            actionType: actionType,
            ethValuePreFee: ethValuePreFee,
            ethFee: ethFee,
            ethMarketplaceFee: ethMarketplaceFee,
            ethValuePostFee: ethValuePostFee,
            fiatValuePreFee: fiatValuePreFee,
            fiatFee: fiatFee,
            fiatMarketplaceFee: fiatMarketplaceFee,
            fiatValuePostFee: fiatValuePostFee,
            nftName: nftName,
            tokenID: t.token_id,
            walletAddress: t.wallet,
            quantity: t.quantity
        }

        console.log();
        processedTransactions.push(tempObj);
        await timeout(160);
    }

    return processedTransactions;
}

async function getSellerPercentage(tokenAddress) {
    if (!getSellerPercentage.hasOwnProperty('proxies')) {
        getSellerPercentage.proxies = [
            process.env.PROXY_1,
            process.env.PROXY_2,
            process.env.PROXY_3,
            process.env.PROXY_4,
            process.env.PROXY_5
        ];
        getSellerPercentage.proxyIndex = 0;
    }

    const proxyAgent = new HttpsProxyAgent(getSellerPercentage.proxies[getSellerPercentage.proxyIndex]);
    getSellerPercentage.proxyIndex++;
    if (getSellerPercentage.proxyIndex > getSellerPercentage.proxies.length - 1)
        getSellerPercentage.proxyIndex = 0;

    const response = await fetch(`https://api.opensea.io/api/v1/asset_contract/${tokenAddress}`, { agent: proxyAgent });

    if (!response) {
        throw new Error('getSellerPercentage failed before json parse.');
    }

    const responseJSON = await response.json();

    if (!responseJSON || !responseJSON.seller_fee_basis_points) {
        console.error(responseJSON);
        throw new Error('getSellerPercentage Failed...');
    }

    return responseJSON.seller_fee_basis_points;
}

function separateIntoMonths(processedTransactions) {
    const txnMonths = new Array(12);

    // initialize with 12 empty arrays for each month
    for (let i = 0; i < 12; i++) {
        txnMonths[i] = [];
    }

    if (processedTransactions.length === 0)
        return txnMonths;

    for (let t of processedTransactions) {
        txnMonths[t.date.getMonth()].push(t);
    }

    return txnMonths;
}

exports.timeout = timeout;
exports.retryIfError = retryIfError;
exports.getWalletsPrompt = getWalletsPrompt;
exports.getWalletsFile = getWalletsFile;
exports.getWallets = getWallets;
exports.queryMoralis = queryMoralis;
exports.processTransactions = processTransactions;
exports.getSellerPercentage = getSellerPercentage;
exports.separateIntoMonths = separateIntoMonths;