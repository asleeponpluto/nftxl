const ExcelJS = require('exceljs');
const currency = require("currency.js");

const util = require('./util');

async function createNFTWorksheet(processedTransactions) {
    const workbook = new ExcelJS.Workbook();
    const months = ["Jan", "Feb", "Mar" ,"Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // {
    //     date: 2021-11-07T20:37:46.000Z,
    //     txnHash: '0x973f11368477d5f633bdee87e9811fd3abf8b87eb05fb8970d0fdc389e36363b',
    //     to: '0x95b39f96942c2482d733f7f972adcae04823dbad',
    //     from: '0xbf9aa536d6e151488c1059742398fc3574725dad',
    //     actionType: 'buy',
    //     ethValue: 0.25,
    //     ethFee: 0.024064931381211074,
    //     fiatValue: 1130.93,
    //     fiatFee: 108.86,
    //     nftName: 'Cosmic Labs',
    //     tokenID: '2464',
    //     walletAddress: '0x95b39f96942c2482d733f7f972adcae04823dbad',
    //     quantity: 1
    // }


    const txnMonths = util.separateIntoMonths(processedTransactions);

    for (let i = 0; i < 12; i++) {
        const worksheet = workbook.addWorksheet(months[i]);

        worksheet.columns = [
            { header: 'Date', key: 'date' },
            { header: 'TxnHash', key: 'txnHash' },
            { header: 'From', key: 'from' },
            { header: 'To', key: 'to' },
            { header: 'ActionType', key: 'actionType' },
            { header: 'EthValue', key: 'ethValue' },
            { header: 'EthFee', key: 'ethFee' },
            { header: 'EthMarketplaceFee', key: 'ethMarketplaceFee' },
            { header: 'FiatValue', key: 'fiatValue' },
            { header: 'FiatFee', key: 'fiatFee' },
            { header: 'FiatMarketplaceFee', key: 'fiatMarketplaceFee' },
            { header: 'NftName', key: 'nftName' },
            { header: 'TokenID', key: 'tokenID' },
            { header: 'WalletAddress', key: 'walletAddress' },
            { header: 'Quantity', key: 'quantity' }
        ];

        for (let t of txnMonths[i]) {
            worksheet.addRow(t);
        }

        worksheet.getColumn('date').width = 12;
        worksheet.getColumn('txnHash').width = 12;
        worksheet.getColumn('from').width = 12;
        worksheet.getColumn('to').width = 12;
        worksheet.getColumn('actionType').width = 12;
        worksheet.getColumn('ethValue').width = 12;
        worksheet.getColumn('ethFee').width = 12;
        worksheet.getColumn('ethMarketplaceFee').width = 20;
        worksheet.getColumn('fiatValue').width = 12;
        worksheet.getColumn('fiatFee').width = 12;
        worksheet.getColumn('fiatMarketplaceFee').width = 20;
        worksheet.getColumn('nftName').width = 12;
        worksheet.getColumn('tokenID').width = 12;
        worksheet.getColumn('walletAddress').width = 15;
        worksheet.getColumn('quantity').width = 12;

        worksheet.addConditionalFormatting({
            ref: `A2:O${worksheet.rowCount}`,
            rules: [
                {
                    type: 'expression',
                    formulae: ['=$E2="buy"'],
                    style: {
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFCCCCFF'}},
                        border: {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}}
                    }
                },
                {
                    type: 'expression',
                    formulae: ['=$E2="sell"'],
                    style: {
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FF99CC0'}},
                        border: {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}}
                    }
                },
                {
                    type: 'expression',
                    formulae: ['=$E2="mint"'],
                    style: {
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFDAEEF3'}},
                        border: {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}}
                    }
                },
                {
                    type: 'expression',
                    formulae: ['=$E2="transfer (in)"'],
                    style: {
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFCCFFCC'}},
                        border: {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}}
                    }
                },
                {
                    type: 'expression',
                    formulae: ['=$E2="transfer (out)"'],
                    style: {
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFFFFF99'}},
                        border: {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}}
                    }
                },
                {
                    type: 'expression',
                    formulae: ['=$E2="burn"'],
                    style: {
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFFF8080'}},
                        border: {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}}
                    }
                },
            ]
        });

        worksheet.getRow(1).eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {argb: 'FFBABABA'}
            };

            // cell.border = {
            //     top: {style:'thin'},
            //     left: {style:'thin'},
            //     bottom: {style:'thin'},
            //     right: {style:'thin'}
            // };
        });
    }

    const totalsWorksheet = workbook.addWorksheet('NFT Totals');
    totalsWorksheet.columns = [
        { header: 'Total Eth Spent', key: 'totalEthSpent' },
        { header: 'Total USD Spent', key: 'totalUSDSpent' },
        { header: 'Total Eth Gained', key: 'totalEthGained' },
        { header: 'Total USD Gained', key: 'totalUSDGained' },
        { header: 'Total Fees Eth', key: 'totalFeesEth' },
        { header: 'Total Fees USD', key: 'totalFeesUSD' },
        { header: 'Total Marketplace Fees Eth', key: 'totalMarketplaceFeesEth' },
        { header: 'Total Marketplace Fees USD', key: 'totalMarketplaceFeesUSD' },
        { header: 'Total Profit Eth', key: 'totalProfitEth' },
        { header: 'Total Profit USD', key: 'totalProfitUSD' }
    ]

    let nftTotals = {
        totalEthSpent: 0, // mint buy
        totalUSDSpent: 0,
        totalEthGained: 0, // sell
        totalUSDGained: 0,
        totalFeesEth: 0, // mint buy
        totalFeesUSD: 0,
        totalMarketplaceFeesEth: 0,
        totalMarketplaceFeesUSD: 0,
        totalProfitEth: 0,
        totalProfitUSD: 0
    };

    for (let t of processedTransactions) {
        if (t.actionType !== 'sell') {
            nftTotals.totalEthSpent += t.ethValue;
            nftTotals.totalUSDSpent = currency(nftTotals.totalUSDSpent).add(t.fiatValue).value;
            nftTotals.totalFeesEth += t.ethFee;
            nftTotals.totalFeesUSD = currency(nftTotals.totalFeesUSD).add(t.fiatFee).value;
        } else {
            nftTotals.totalEthGained += t.ethValue;
            nftTotals.totalUSDGained = currency(nftTotals.totalUSDGained).add(t.fiatValue).value;
        }

        nftTotals.totalMarketplaceFeesEth += t.ethMarketplaceFee;
        nftTotals.totalMarketplaceFeesUSD += t.fiatMarketplaceFee;
    }

    nftTotals.totalProfitEth = nftTotals.totalEthGained - nftTotals.totalEthSpent - nftTotals.totalFeesEth;
    nftTotals.totalProfitUSD = nftTotals.totalUSDGained - nftTotals.totalUSDSpent - nftTotals.totalFeesUSD;
    totalsWorksheet.addRow(nftTotals);

    await workbook.xlsx.writeFile('something.xlsx');
}

exports.createNFTWorksheet = createNFTWorksheet;