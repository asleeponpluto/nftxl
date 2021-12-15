const readline = require('readline');
const fs = require('fs');
const Moralis = require("moralis/node");

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
        else walletArr.push(lastInputted);
    }

    return walletArr;
}

// returns an array with all read addresses
async function getWalletsFile(filePath) {
    const data = fs.readFileSync(filePath, {encoding: 'utf8'});
    const dirtyLines = data.split(/[\r\n]+/);
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
                order: 'block_timestamp.DESC'
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

            if (transactions.result.length !== 0)
                cleanTransactionArr = cleanTransactionArr.concat(transactions.result);
            else
                dateReached = true;

            page++;
            console.log('500 items queried...');
            await timeout(2000);
        }
    }

    return cleanTransactionArr;
}

async function processTransactions(transactions) {
    let processedTransactions = [];

    for (let t of transactions) {
        let tempObj = {
            date: new Date(t.block_timestamp),
            to: t.to_address,
            from: t.from_address,
        }

        processedTransactions.push(tempObj);
    }

    return processedTransactions;
}

exports.timeout = timeout;
exports.getWalletsPrompt = getWalletsPrompt;
exports.getWalletsFile = getWalletsFile;
exports.getWallets = getWallets;
exports.queryMoralis = queryMoralis;
exports.processTransactions = processTransactions;