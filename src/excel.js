const ExcelJS = require('exceljs');
const currency = require("currency.js");

const util = require('./util');

async function createNFTWorksheet(processedTransactions) {
    const workbook = new ExcelJS.Workbook();
    const months = ["Jan", "Feb", "Mar" ,"Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const txnMonths = util.separateIntoMonths(processedTransactions);

    for (let i = 0; i < 12; i++) {
        const worksheet = workbook.addWorksheet(months[i]);

        worksheet.columns = [
            { header: 'Date', key: 'date' },
            { header: 'TxnHash', key: 'txnHash' },
            { header: 'From', key: 'from' },
            { header: 'To', key: 'to' },
            { header: 'Action', key: 'actionType' },
            { header: 'ETH Transacted (Gross)', key: 'ethValuePreFee' },
            { header: 'Gas Fee (ETH)', key: 'ethGasFee' },
            { header: 'Royalties (ETH)', key: 'ethMarketplaceFee' },
            { header: 'ETH Transacted (Net)', key: 'ethValuePostFee' },
            { header: 'USD Transacted (Gross)', key: 'fiatValuePreFee' },
            { header: 'Gas Fee (USD)', key: 'fiatGasFee' },
            { header: 'Royalties (USD)', key: 'fiatMarketplaceFee' },
            { header: 'USD Transacted (Net)', key: 'fiatValuePostFee' },
            { header: 'NFT Name', key: 'nftName' },
            { header: 'Token', key: 'tokenID' },
            { header: 'Wallet', key: 'walletAddress' },
            { header: 'Quantity', key: 'quantity' }
        ];

        // dates recent to old
        // for (let t of txnMonths[i]) {
        //     worksheet.addRow(t);
        // }

        // dates old to recent
        for (let j = txnMonths[i].length - 1; j >= 0; j--) {
            worksheet.addRow(txnMonths[i][j]);
        }

        const columnsWithSums = [
            'ethValuePreFee',
            'ethGasFee',
            'ethMarketplaceFee',
            'ethValuePostFee',
            'fiatValuePreFee',
            'fiatGasFee',
            'fiatMarketplaceFee',
            'fiatValuePostFee',
            'quantity'
        ];

        const lastRowNum = worksheet.lastRow.number;
        for (let colKey of columnsWithSums) {
            const colLetter = worksheet.getColumn(colKey).letter;
            worksheet.getCell(`${colLetter}${lastRowNum + 2}`).value = {
                formula: `SUM(${colLetter}2:${colLetter}${lastRowNum})`
            };
        }

        worksheet.getColumn('date').width = 12;
        worksheet.getColumn('txnHash').width = 12;
        worksheet.getColumn('from').width = 12;
        worksheet.getColumn('to').width = 12;
        worksheet.getColumn('actionType').width = 14;
        worksheet.getColumn('ethValuePreFee').width = 22;
        worksheet.getColumn('ethGasFee').width = 14;
        worksheet.getColumn('ethMarketplaceFee').width = 18;
        worksheet.getColumn('ethValuePostFee').width = 22;
        worksheet.getColumn('fiatValuePreFee').width = 22;
        worksheet.getColumn('fiatGasFee').width = 14;
        worksheet.getColumn('fiatMarketplaceFee').width = 18;
        worksheet.getColumn('fiatValuePostFee').width = 22;
        worksheet.getColumn('nftName').width = 20;
        worksheet.getColumn('tokenID').width = 12;
        worksheet.getColumn('walletAddress').width = 16;
        worksheet.getColumn('quantity').width = 12;

        worksheet.addConditionalFormatting({
            ref: `A2:${worksheet.lastColumn.letter}${worksheet.lastRow.number}`,
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
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FF99CC00'}},
                        border: {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}}
                    }
                },
                {
                    type: 'expression',
                    formulae: ['=$E2="mint"'],
                    style: {
                        fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFCC99FF'}},
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

        worksheet.columns.forEach((col) => {
            worksheet.lastRow.getCell(col.letter).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {argb: 'FFF2F2F2'}
            };

            worksheet.lastRow.getCell(col.letter).border = {
                top: {style:'thin', color:{argb:'FF7F7F7F'}},
                left: {style:'thin', color:{argb:'FF7F7F7F'}},
                bottom: {style:'thin', color:{argb:'FF7F7F7F'}},
                right: {style:'thin', color:{argb:'FF7F7F7F'}}
            };
        });
    }

    const totalsWorksheet = workbook.addWorksheet('NFT Totals');
    totalsWorksheet.columns = [
        { header: 'Total ETH Spent (Gross)', key: 'totalEthSpentPreFee' },
        { header: 'Total ETH Spent (Gas)', key: 'totalEthSpentGasFee' },
        { header: 'Total ETH Spent (Net)', key: 'totalEthSpentPostFee' },
        { header: 'Total ETH Received (Gross)', key: 'totalEthGainedPreFee' },
        { header: 'Total Royalties Paid (ETH)', key: 'totalEthSpentMarketFee' },
        { header: 'Total ETH Profit (Net)', key: 'totalEthGainedPostFee' },
        { header: 'Total USD Spent (Gross)', key: 'totalUSDSpentPreFee' },
        { header: 'Total USD Spent (Gas)', key: 'totalUSDSpentGasFee' },
        { header: 'Total USD Spent (Net)', key: 'totalUSDSpentPostFee' },
        { header: 'Total USD Received (Gross)', key: 'totalUSDGainedPreFee' },
        { header: 'Total Royalties Paid (USD)', key: 'totalUSDSpentMarketFee' },
        { header: 'Total USD Profit (Net)', key: 'totalUSDGainedPostFee' }
    ]

    let nftTotals = {
        totalEthSpentPreFee: 0,
        totalEthSpentGasFee: 0,
        totalEthSpentPostFee: 0,
        totalEthGainedPreFee: 0,
        totalEthSpentMarketFee: 0,
        totalEthGainedPostFee: 0,
        totalUSDSpentPreFee: 0,
        totalUSDSpentGasFee: 0,
        totalUSDSpentPostFee: 0,
        totalUSDGainedPreFee: 0,
        totalUSDSpentMarketFee: 0,
        totalUSDGainedPostFee: 0
    };

    for (let t of processedTransactions) {
        // TODO add burn here
        // TODO paidForTransfer shouldn't add to totalEthSpentPreFee... only gas fee (confirm)
        if (t.actionType === 'buy' || t.actionType === 'mint' || t.actionType === 'transfer (out)' || t.paidForTransfer) {
            // eth
            nftTotals.totalEthSpentPreFee += t.ethValuePreFee;
            nftTotals.totalEthSpentGasFee += t.ethGasFee;

            // usd
            nftTotals.totalUSDSpentPreFee = currency(nftTotals.totalUSDSpentPreFee).add(t.fiatValuePreFee).value;
            nftTotals.totalUSDSpentGasFee = currency(nftTotals.totalUSDSpentGasFee).add(t.fiatGasFee).value;
        } else if (t.actionType === 'sell') {
            // eth
            nftTotals.totalEthSpentMarketFee += t.ethMarketplaceFee;
            nftTotals.totalEthGainedPreFee += t.ethValuePreFee;

            // usd
            nftTotals.totalUSDSpentMarketFee = currency(nftTotals.totalUSDSpentMarketFee).add(t.fiatMarketplaceFee).value;
            nftTotals.totalUSDGainedPreFee = currency(nftTotals.totalUSDGainedPreFee).add(t.fiatValuePreFee).value;
        } else if (t.actionType === 'transfer (in)') {
            // eth
            nftTotals.totalEthGainedPreFee += t.ethValuePreFee;

            // usd
            nftTotals.totalUSDGainedPreFee = currency(nftTotals.totalUSDGainedPreFee).add(t.fiatValuePreFee).value;
        }
    }

    // eth
    nftTotals.totalEthSpentPostFee = nftTotals.totalEthSpentPreFee + nftTotals.totalEthSpentGasFee;
    nftTotals.totalEthGainedPostFee = nftTotals.totalEthGainedPreFee - nftTotals.totalEthSpentMarketFee - nftTotals.totalEthSpentPostFee;

    // usd
    nftTotals.totalUSDSpentPostFee = currency(nftTotals.totalUSDSpentPreFee).add(nftTotals.totalUSDSpentGasFee).value;
    nftTotals.totalUSDGainedPostFee = currency(nftTotals.totalUSDGainedPreFee).subtract(nftTotals.totalUSDSpentMarketFee).subtract(nftTotals.totalUSDSpentPostFee).value;

    totalsWorksheet.addRow(nftTotals);

    totalsWorksheet.getColumn('totalEthSpentPreFee').width = 22;
    totalsWorksheet.getColumn('totalEthSpentGasFee').width = 22;
    totalsWorksheet.getColumn('totalEthSpentPostFee').width = 22;
    totalsWorksheet.getColumn('totalEthGainedPreFee').width = 24;
    totalsWorksheet.getColumn('totalEthSpentMarketFee').width = 24;
    totalsWorksheet.getColumn('totalEthGainedPostFee').width = 22;
    totalsWorksheet.getColumn('totalUSDSpentPreFee').width = 22;
    totalsWorksheet.getColumn('totalUSDSpentGasFee').width = 22;
    totalsWorksheet.getColumn('totalUSDSpentPostFee').width = 22;
    totalsWorksheet.getColumn('totalUSDGainedPreFee').width = 24;
    totalsWorksheet.getColumn('totalUSDSpentMarketFee').width = 24;
    totalsWorksheet.getColumn('totalUSDGainedPostFee').width = 22;

    totalsWorksheet.getRow(1).eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {argb: 'FFBABABA'}
        };
    });

    totalsWorksheet.getRow(1).getCell('totalEthGainedPostFee').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {argb: 'FFCCFFCC'}
    };
    totalsWorksheet.getRow(1).getCell('totalUSDGainedPostFee').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {argb: 'FFCCFFCC'}
    };

    await workbook.xlsx.writeFile('something.xlsx');
}

exports.createNFTWorksheet = createNFTWorksheet;
