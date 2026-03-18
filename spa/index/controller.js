var IndexController = function(view) {
    var context = window.indexContext = this;
    context.view = view;

    context.sortSynopticPools = function(pools) {
        // Match pools({ from: address(0) }): unbalanced first, then descending surplus.
        return pools.map((item, order) => ({ item, order })).sort((a, b) => {
            var group = Number(b.item.rebalanceNeeded) - Number(a.item.rebalanceNeeded);
            return group || web3utils.toBN(b.item.convertedSurplus).cmp(web3utils.toBN(a.item.convertedSurplus)) || a.order - b.order;
        }).map(entry => entry.item);
    };

    context.pendingPayout = function(pools) {
        var total = web3utils.toBN(0);
        for(var item of pools) {
            var surplus = web3utils.toBN(item.surplus0).add(web3utils.toBN(item.surplus1));
            var fee = web3utils.toBN(item.feeAmount0).add(web3utils.toBN(item.feeAmount1));
            var inProfit = web3utils.toBN(item.poolAmount0).add(web3utils.toBN(item.poolAmount1)).gte(web3utils.toBN(item.savedAmount0).add(web3utils.toBN(item.savedAmount1)));
            var share = fee.muln(inProfit ? 9 : 7).divn(10);
            total = total.add(surplus.gt(share) ? surplus : share);
        }
        return total;
    };

    context.refreshBalance = async function refreshBalance() {
        var session = window.walletSession;
        var state = context.view.state;
        var tokenAddress = state[state.mode + 'TokenAddress'];
        if(!session || !session.active || !state.walletAddress || !tokenAddress) return;
        var mode = state.mode;
        try {
            var balance, allowance;
            if(tokenAddress === voidEthereumAddress) {
                allowance = balance = await web3.eth.getBalance(state.walletAddress);
            } else {
                balance = abi.decode(['uint256'], await call(tokenAddress, 'balanceOf(address)', state.walletAddress))[0].toString();
                allowance = abi.decode(['uint256'], await call(tokenAddress, 'allowance(address,address)', state.walletAddress, window.context.managerAddress))[0].toString();
            }
            if(session.active && context.view.state.mode === mode && context.view.state[mode + 'TokenAddress'] === tokenAddress) context.view.setState({ balance, allowance });
        } catch(e) { if(session.active) console.log(e); }
    };

    context.getManager = function() {
        requireWalletSession();
        return context.manager = context.manager || new web3.eth.Contract(window.context.ManagerABI, window.context.managerAddress);
    };

    context.refreshReferral = async function() {
        var session = requireWalletSession();
        try {
            var enabled = await context.getManager().methods.referrals(session.address).call();
            if(session.active) context.view.setState({ connectedIsReferral: enabled });
        } catch(e) {
            if(session.active) context.view.setState({ connectedIsReferral: false });
            console.log(e);
        }
    };

    context.approveForAddLiquidity = function approveForAddLiquidity(address, value) {
        requireWalletSession();
        return prepareAndSendTx((new web3.eth.Contract(window.context.IERC20ABI, address)).methods.approve(window.context.managerAddress, value), {
            returnReceipt : true,
            throwError : true
        }).then(context.refreshBalance);
    }

    context.addLiquidity = async function addLiquidity(address, value, subject) {
        var session = requireWalletSession();
        subject = (subject || '').trim() || voidEthereumAddress;
        if(!web3utils.isAddress(subject)) throw new Error("Invalid beneficiary address.");
        var manager = context.getManager();
        if(subject.toLowerCase() !== voidEthereumAddress && subject.toLowerCase() !== session.address.toLowerCase() && !context.view.state.isOwner) {
            if(!await manager.methods.referrals(session.address).call()) throw new Error("Protocol authorization is required to deposit for another address.");
        }
        if(!session.active) throw new Error("Wallet network or account changed.");
        return prepareAndSendTx(manager.methods.addLiquidity(address, value, context.view.state.referenceTokenAddress, subject), {
            returnReceipt : true,
            throwError : true,
            value : address === voidEthereumAddress ? value : "0"
        }).then(context.refreshBalance);
    }

    context.estimateLiquidityRewards = async function(address, amount, subject, outputTokenAddress) {
        var session = requireWalletSession();
        var manager = context.getManager();
        var network = getAppNetwork(session.chainId);
        var rewardSymbol = session.chainId === 8453 ? 'USDC' : 'USDG';
        var rewardToken = Object.keys(network.tokenRegistry).find(address => network.tokenRegistry[address].symbol === rewardSymbol);
        var outputToken = getTokenMetaByAddress(outputTokenAddress);
        if(!rewardToken || !outputToken) throw new Error('Reward token unavailable');
        var block = await web3.eth.getBlock('latest');
        ensureLiquidityForecastSession(session);
        var timestamp = parseInt(block.timestamp);
        var number = parseInt(block.number);
        var end = Math.floor(timestamp / 86400) * 86400;
        var data = await manager.methods.data(rewardToken).call(undefined, number);
        ensureLiquidityForecastSession(session);
        var interval = parseInt(data.nextRebalanceEvent) - parseInt(data.seasonStart);
        if(interval !== 0 && interval !== 3600) throw new Error('Unexpected reward season interval');
        var beneficiary = subject && subject.toLowerCase() !== voidEthereumAddress ? subject : session.address;
        var [shares, historicalRewards] = await Promise.all([
            estimateDepositShare(session, manager, address, amount, beneficiary, rewardToken, data.totalProvided, number),
            liquidityRewardHistory(session, manager, end, 3600)
        ]);
        ensureLiquidityForecastSession(session);
        var gross = web3utils.toBN(historicalRewards);
        var unit = web3utils.toBN('1000000000000000000');
        var convert = async function(value) {
            return value.isZero() || rewardToken.toLowerCase() === outputTokenAddress.toLowerCase() ? value : web3utils.toBN(await manager.methods.convert(voidEthereumAddress, rewardToken, value.toString(), outputTokenAddress).call(undefined, number));
        };
        var [withdrawal, projectedGross, creditedDeposit] = await Promise.all([
            shares.current.isZero() ? { originallyProvided : '0', removedAmount : '0' } : manager.methods.removeLiquidity(unit.toString(), outputTokenAddress).call({ from : beneficiary }, number),
            convert(gross),
            convert(shares.credited)
        ]);
        ensureLiquidityForecastSession(session);
        var startingValue = web3utils.toBN(withdrawal.removedAmount);
        var money = value => formatForecastAmount(parseFloat(fromDecimals(value.toString(), outputToken.decimals, true)));
        var capitalResult = startingValue.sub(web3utils.toBN(withdrawal.originallyProvided));
        var investedValue = startingValue.add(creditedDeposit);
        var totalRemoved = web3utils.toBN(data.totalValueLocked);
        var heritage = web3utils.toBN(data.totalProvided);
        var sharePercent = share => formatMoney(fromDecimals(share.muln(100).toString(), 18, true), 4);
        var totals = [3, 6, 9, 12].map(function(months) {
            var seconds = liquidityHorizonSeconds(timestamp, months);
            var reward = projectedGross.mul(shares.projected).muln(seconds / 86400);
            if(!heritage.isZero()) reward = reward.mul(totalRemoved).div(heritage);
            reward = reward.divn(28).div(unit);
            return { months, reward, total : investedValue.add(reward) };
        });
        var annual = totals[totals.length - 1].total;
        return {
            start : end - 28 * 86400,
            end,
            startingValue : money(startingValue),
            capitalResult : money(capitalResult),
            capitalLoss : capitalResult.isNeg(),
            currentParticipation : sharePercent(shares.current),
            projectedParticipation : sharePercent(shares.projected),
            alreadyFullShare : shares.current.toString() === '1000000000000000000' && shares.projected.eq(shares.current),
            estimates : totals.map(function(item) {
                return {
                    months : item.months,
                    value : money(item.total),
                    grossRewards : money(item.reward),
                    roi : investedValue.isZero() ? null : formatMoney(item.reward.muln(100).div(investedValue).toString(), 0),
                    barWidth : annual.isZero() ? 0 : item.total.muln(10000).div(annual).toNumber() / 100
                };
            })
        };
    };

    function ensureLiquidityForecastSession(session) {
        if(!session.active || session !== window.walletSession) throw new Error('Wallet network or account changed');
    }

    async function estimateDepositShare(session, manager, address, amount, beneficiary, rewardToken, totalProvided, blockNumber) {
        var unit = web3utils.toBN('1000000000000000000');
        var value = web3utils.toBN(amount);
        var position = await manager.methods.claimReward(rewardToken).call({ from : beneficiary }, blockNumber);
        var currentShare = web3utils.toBN(position.participationPercentage);
        if(value.isZero()) return { current : currentShare, projected : currentShare, credited : value };
        ensureLiquidityForecastSession(session);
        var owner = (await manager.methods.owner().call(undefined, blockNumber)).toLowerCase();
        var isOwner = session.address.toLowerCase() === owner;
        var pool = web3utils.toBN(totalProvided);
        if(!isOwner && session.chainId !== 8453) {
            ensureLiquidityForecastSession(session);
            var simulation = await manager.methods.addLiquidity(address, amount, rewardToken, beneficiary).call({
                from : session.address,
                value : address === voidEthereumAddress ? amount : '0'
            }, blockNumber);
            var projected = web3utils.toBN(simulation.updatedParticipationPercentage);
            var credited = projected.mul(pool.add(web3utils.toBN(simulation.addedAmount))).sub(currentShare.mul(pool)).div(unit);
            return { current : currentShare, projected, credited : credited.isNeg() ? web3utils.toBN(0) : credited };
        }
        ensureLiquidityForecastSession(session);
        var deposit = address.toLowerCase() === rewardToken.toLowerCase() ? value : web3utils.toBN(await manager.methods.convert(voidEthereumAddress, address, amount, rewardToken).call(undefined, blockNumber));
        if(deposit.isZero()) throw new Error('Deposit quote unavailable');
        var creditedBps = isOwner ? 10000 : beneficiary.toLowerCase() === owner ? 9875 : 9750;
        var weightedDeposit = deposit.mul(unit).muln(creditedBps).divn(10000);
        var projectedShare = currentShare.mul(pool).add(weightedDeposit).div(pool.add(deposit));
        return { current : currentShare, projected : projectedShare, credited : weightedDeposit.div(unit) };
    }

    function liquidityHorizonSeconds(timestamp, months) {
        var date = new Date(timestamp * 1000);
        var day = date.getUTCDate();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + months);
        var last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        date.setUTCDate(Math.min(day, last));
        return date.getTime() / 1000 - timestamp;
    }

    function liquidityRewardHistory(session, manager, end, interval) {
        var key = networkStorageKey(['liquidityRewardHistory', manager.options.address, end, interval].join(':').toLowerCase());
        var stored = readStored(key);
        if(typeof stored === 'string' && /^\d+$/.test(stored)) return Promise.resolve(stored);
        if(context.liquidityHistory?.key === key && context.liquidityHistory.session === session) return context.liquidityHistory.promise;
        var start = end - 28 * 86400;
        var promise = Promise.all([blockAt(start - interval, session), blockAt(end, session)]).then(async function(blocks) {
            ensureLiquidityForecastSession(session);
            var logs = await managerLogs([web3utils.sha3('SeasonStarted(uint256,uint256)')], blocks[0].number, blocks[1].number - 1, session);
            var total = sumLiquiditySeasonRewards(logs, start, end, interval).toString();
            ensureLiquidityForecastSession(session);
            window.localStorage.setItem(key, JSON.stringify(total));
            return total;
        });
        context.liquidityHistory = { key, session, promise };
        promise.catch(function() {
            if(context.liquidityHistory?.promise === promise) context.liquidityHistory = null;
        });
        return promise;
    }

    function sumLiquiditySeasonRewards(logs, start, end, interval) {
        if(!logs.length) throw new Error('No reward season history found');
        var seasons = new Set();
        var total = web3utils.toBN(0);
        for(var log of logs) {
            var values = web3.eth.abi.decodeParameters(['uint256', 'uint256'], log.data);
            var stop = parseInt(values[1]);
            if(seasons.has(stop)) continue;
            seasons.add(stop);
            var seconds = Math.max(0, Math.min(end, stop) - Math.max(start, stop - interval));
            total = total.add(web3utils.toBN(values[0]).muln(seconds));
        }
        return total;
    }

    var harvestPolicyABI = [{ type: 'function', name: 'harvestPolicy', stateMutability: 'view', inputs: [], outputs: [{ name: 'enabled', type: 'bool' }, { name: 'harvestGap', type: 'uint256' }, { name: 'rebalanceWait', type: 'uint256' }] }];

    context.readHarvestPolicy = async function() {
        requireWalletSession();
        var manager = context.getManager();
        var codeAddress = await manager.methods.code().call();
        var policy = await new web3.eth.Contract(harvestPolicyABI, codeAddress).methods.harvestPolicy().call();
        var block = await web3.eth.getBlock('latest');
        return {
            enabled: policy.enabled === true || policy.enabled === 'true',
            harvestGap: parseInt(policy.harvestGap),
            chainTime: parseInt(block.timestamp) * 1000,
            readAt: Date.now()
        };
    };

    context.checkReferral = function(address) {
        requireWalletSession();
        return context.getManager().methods.referrals(web3utils.toChecksumAddress(address)).call();
    }

    context.manageReferrals = function(toAdd, toRemove) {
        var session = requireWalletSession();
        function parseAddresses(value) {
            var addresses = value.trim().split(/[\s,;]+/).filter(Boolean);
            if(addresses.some(address => !web3utils.isAddress(address))) throw new Error("Enter valid referral addresses separated by commas or new lines.");
            return [...new Set(addresses.map(address => web3utils.toChecksumAddress(address)))];
        }
        var additions = parseAddresses(toAdd), removals = parseAddresses(toRemove);
        if(!additions.length && !removals.length) throw new Error("Enter at least one referral address.");
        return prepareAndSendTx(context.getManager().methods.manageReferrals(additions, removals), { returnReceipt: true, throwError: true }).then(async receipt => {
            if(session.active) await context.refreshReferral();
            return receipt;
        });
    }

    context.removeLiquidity = function removeLiquidity(address, value, readonly) {
        var method = context.getManager().methods.removeLiquidity(value, address);
        return readonly ? method.call({from : context.view.state.walletAddress}) : prepareAndSendTx(method);
    }

    async function getSyncIndices(manager) {
        var result;
        try {
            result = await manager.methods.pools([]).call({from : voidEthereumAddress});
        } catch(e) {
            var pending = [e];
            var seen = new Set();
            while(pending.length && !result) {
                var value = pending.shift();
                if(!value || seen.has(value)) continue;
                seen.add(value);
                if(typeof value === 'object') {
                    pending.push(value.data, value.cause, value.originalError, value.return, value.message);
                } else if(typeof value === 'string' && /0x[0-9a-f]+/i.test(value)) {
                    var hex = value.match(/0x[0-9a-f]+/i)[0];
                    try {
                        var decoded = abi.decode(['int256[]'], hex)[0];
                        if(abi.encode(['int256[]'], [decoded]).toLowerCase() === hex.toLowerCase()) {
                            result = decoded;
                        }
                    } catch {}
                }
            }
            if(!result) throw e;
        }
        var values = result.map(it => it.toString());
        if(values[0] !== String(values.length - 1) || values.slice(1).some(it => it !== '-1' && !/^\d+$/.test(it))) {
            throw new Error("Invalid pool selection from Manager.");
        }
        return values.slice(1).filter(it => it !== '-1');
    }

    context.rebalance = async function rebalance() {
        var session = requireWalletSession();
        var manager = context.getManager();
        var idx = await getSyncIndices(manager);
        if(!session.active) throw new Error("Wallet network or account changed.");
        if(idx.length === 0) {
            context.init();
            return;
        }
        var originalException;
        var times = 3;
        while(true) {
            try {
                for(var i = 0; i < times; i++) {
                    if(!session.active) throw new Error("Wallet network or account changed.");
                    await manager.methods.pools(idx).estimateGas({
                        from : session.address,
                        gas : 16700000
                    });
                    await sleep(1500);
                }
                break;
            } catch(e) {
                originalException = originalException || e;
                var message = (e.message || e).toString().toLowerCase().trim();
                if(message != "returned error: execution reverted" && message.split(" ").join("").split("'").join('"').indexOf('"cause":null') === -1) {
                    throw e;
                }
                idx.pop();
                if(idx.length === 0) {
                    throw originalException || e;
                } 
            }
        }
        if(!session.active) throw new Error("Wallet network or account changed.");
        return prepareAndSendTx(manager.methods.pools(idx));
    }

    context.claimReward = function claimReward() {
        return prepareAndSendTx(context.getManager().methods.claimReward(context.view.state.referenceTokenAddress));
    }

    async function prepareAndSendTx(method, options = {}) {
        var session = requireWalletSession();
        context.timeout && clearTimeout(context.timeout);
        var account = session.address;
        var tx = {
            from : account,
            chainId : web3utils.numberToHex(session.chainId),
            value : '0x0',
            gas : 16700000
        };
        options.value !== undefined && options.value !== '0' && (tx.value = web3utils.numberToHex(options.value));
        tx = {
            ...tx,
            to: method._parent.options.address,
            data: method.encodeABI(),
            gasPrice: web3utils.numberToHex(await web3.eth.getGasPrice())
        };
        try {
            if(!session.active) throw new Error("Wallet network or account changed.");
            var receipt = await web3.eth.sendTransaction(tx);
            console.log(receipt);
            context.init();
            if(options.returnReceipt) {
                await new Promise(ok => setTimeout(ok, 2000));
                return receipt;
            } else {
                window.open(getEtherscanAddress('tx/' + receipt.transactionHash, session.chainId), '_blank', 'noopener,noreferrer');
            }
        } catch(e) {
            console.log(e);
            if(options.throwError) {
                throw e;
            } else {
                alert("Error: " + (e.message || e).toString());
            }
        }
    }

    window.timeMachine = async function timeMachine(blockNumber) {
        if(Array.isArray(blockNumber)) {
            for(var b of blockNumber) {
                await window.timeMachine(b);
                context.timeout && clearTimeout(context.timeout);
                await new Promise(ok => setTimeout(ok, 5000));
            }
            return await window.timeMachine();
        }
        !blockNumber && window.sessionStorage.removeItem(networkStorageKey("blockNumber"));
        blockNumber && window.sessionStorage.setItem(networkStorageKey("blockNumber"), blockNumber);
        await context.init();
    }

    context.init = async function init() {
        context.timeout && clearTimeout(context.timeout);
        var timeoutLimit = 10000;
        var session = window.walletSession;
        if(!session || !session.active) return;
        var version = context.refreshVersion = (context.refreshVersion || 0) + 1;
        var current = () => session.active && version === context.refreshVersion;
        if(!window.web3?.currentProvider || !context?.view?.state?.walletAddress || !context?.view?.state?.referenceTokenAddress) {
            return context.timeout = setTimeout(context.init, timeoutLimit);
        }
        try {
            context.getManager();
            var from = web3util.utils.toChecksumAddress(context.view.state.walletAddress);
            context.toRebalance = [];
            var manager = context.manager;
            var referenceTokenAddress = context.view.state.referenceTokenAddress;
            var referenceToken = getTokenMetaByAddress(referenceTokenAddress);
            var referenceTokenDecimals = referenceToken.decimals;
            var referenceTokenTicker = referenceToken.symbol;
            var owner = web3util.utils.toChecksumAddress(await manager.methods.owner().call());
            if(!current()) return;
            var isOwner = owner === from;
            context.view.setState({ connectedIsOwner: owner.toLowerCase() === session.address.toLowerCase() });
            
            context.view.emit('initRefresh', [undefined, false, isOwner]);
            var blockNumber = parseInt(window.sessionStorage.getItem(networkStorageKey("blockNumber"))) || "latest";
            var claimRewardResult = await manager.methods.claimReward(referenceTokenAddress).call({from}, blockNumber);
            if(!current()) return;
            var hasFarmingBalance = claimRewardResult.participationPercentage.toString() !== '0' || claimRewardResult.claimedReward.toString() !== '0';
            context.view.updateFarmingBalance(hasFarmingBalance);

            var perc = parseFloat(fromDecimals(claimRewardResult.participationPercentage, 18, true));

            var synopticConverted = window.localStorage.synopticConverted === 'true';
            var taxRateRewards = readRate('taxRate', 33);
            var stampDutyRate = readRate('stampDutyRate', 0.2);
            var whatIfAmount = Math.max(0, parseFloat(window.localStorage.getItem('whatIfAmount')) || 0);
            var net = isOwner && window.localStorage.net === 'true';

            var globalStatus = await manager.methods.data(referenceTokenAddress).call(undefined, blockNumber);
            var nextSeasonReward = globalStatus.nextSeasonReward;
            nextSeasonReward = parseInt(nextSeasonReward) * perc;
            nextSeasonReward = numberToString(nextSeasonReward).split('.')[0];

            var stillInvested = (claimRewardResult.stillInvested.toString().indexOf("-") === -1 ? '0' : claimRewardResult.stillInvested).toString().split('-').join('');
            var claimableReward = claimRewardResult.claimedReward;
            var futureReward = claimRewardResult.participationPercentage.toString() === "0" ? 0 : parseInt(globalStatus.nextRebalanceEvent) - parseInt((await web3.eth.getBlock(blockNumber)).timestamp);
            if(futureReward > 0) {
                futureReward = numberToString(futureReward * (parseInt(globalStatus.rewardPerEvent) * perc)).split('.')[0];
            } else {
                futureReward = '0';
            }
            var heritage = claimRewardResult.participationPercentage.toString() === '0' ? '0' : (await manager.methods.removeLiquidity(numberToString(1e18), referenceTokenAddress).call({from}, blockNumber)).removedAmount;
            var blockTimestamp = parseInt((await web3.eth.getBlock(blockNumber)).timestamp);

            var summarize = async function(pendingPayout) {
                var accruing = web3utils.toBN(futureReward).add(web3utils.toBN(nextSeasonReward)).add(web3utils.toBN(pendingPayout));
                var profitAndLoss = web3utils.toBN(claimRewardResult.stillInvested).add(web3utils.toBN(heritage)).add(web3utils.toBN(claimableReward)).add(web3utils.toBN(futureReward)).add(web3utils.toBN(nextSeasonReward)).toString();

                var segmentEnd = nextSeasonReward === '0' && futureReward === '0' ? blockTimestamp : futureReward === '0' ? parseInt(claimRewardResult._nextRebalanceEvent) : (parseInt(globalStatus.nextRebalanceEvent) + (parseInt(globalStatus.nextRebalanceEvent) - parseInt(globalStatus.seasonStart)));
                var endEvent = segmentEnd - parseInt(claimRewardResult.rewardTimestamp);
                endEvent /= 86400;

                var grossDaily = await grossDailyRate(manager, from, referenceTokenAddress, referenceTokenDecimals, claimRewardResult, blockNumber, blockTimestamp);
                var eoy = horizonOf(blockTimestamp);
                var monitoringStart = parseInt(claimRewardResult.rewardTimestamp);
                if(monitoringStart > 0) monitoringStart = Math.max(monitoringStart, Date.UTC(eoy.year, 0, 1) / 1000);
                var monitoringDays = monitoringStart > 0 ? Math.max(0, blockTimestamp - monitoringStart) / 86400 : 0;
                var baseline = null;
                if(monitoringDays > 0) {
                    baseline = await claimedFeesBaseline(manager, from, referenceTokenAddress, monitoringStart, blockNumber);
                }
                var unclaimedAccrued = parseFloat(fromDecimals(claimableReward, referenceTokenDecimals, true));
                var claimedFees = baseline === null ? 0 : Math.max(0, parseFloat(fromDecimals(web3utils.toBN(claimRewardResult.previouslyClaimedReward).sub(web3utils.toBN(baseline)).toString(), referenceTokenDecimals, true)));
                var feeDaily = isOwner ? await keeperDailyFee(owner, blockTimestamp, referenceTokenAddress, referenceTokenDecimals) : 0;
                var utcLabel = function(timestamp, withHour) {
                    var date = new Date(timestamp * 1000);
                    return date.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()] + (withHour ? ' ' + String(date.getUTCHours()).padStart(2, '0') + ':00' : '') + ' UTC';
                };
                var grossInfo = context.grossInfo || { estimate : true };
                var feeInfo = context.feeInfo || { estimate : true };
                var customRead = !!readNetworkPreference('managerReadRpc');
                var cloudAnnual = isOwner ? await convertFromEUR(60, referenceTokenAddress, referenceTokenDecimals) : 0;
                var taxRate = net ? taxRateRewards : 0;
                var taxDaily = grossDaily * taxRate / 100;
                var heritageValue = parseFloat(fromDecimals(heritage, referenceTokenDecimals, true));
                var stampDaily = net ? heritageValue * stampDutyRate / 100 / 365 : 0;
                var claimFactor = referenceTokenTicker.toUpperCase() === 'USDC' ? 1 : 0.995;
                var claimedTotal = parseFloat(fromDecimals(claimRewardResult.previouslyClaimedReward, referenceTokenDecimals, true)) / claimFactor;
                var stillInvestedValue = parseFloat(fromDecimals(claimRewardResult.stillInvested.toString(), referenceTokenDecimals, true));
                var netProvided = claimedTotal - stillInvestedValue;
                var daily = grossDaily - feeDaily - taxDaily - stampDaily - cloudAnnual / 365;
                var weekly = daily * 7;
                var monthly = daily * 30;
                var heritageRetention = stillInvestedValue < 0 && isFinite(heritageValue)
                    ? Math.min(1, Math.max(0, heritageValue / -stillInvestedValue))
                    : 1;
                var amountsForPeriod = function(projectedDays, elapsedDays, earned, claimed, openingBalance, projectedGrossDaily) {
                    var days = projectedDays + elapsedDays;
                    var gross = earned + projectedGrossDaily * projectedDays;
                    var fees = feeDaily * days;
                    var tax = (claimed + gross) * taxRate / 100;
                    var stamp = stampDaily * days;
                    var afterClaimed = openingBalance + claimed;
                    var afterGross = afterClaimed + gross;
                    var afterFees = afterGross - fees;
                    var afterTax = afterFees - tax;
                    var afterStamp = afterTax - stamp;
                    return { days, gross, fees, tax, stamp, afterClaimed, afterGross, afterFees, afterTax, afterStamp, net : afterStamp - cloudAnnual };
                };
                var currentYearAmounts = amountsForPeriod(eoy.days, monitoringDays, unclaimedAccrued, claimedFees, 0, grossDaily);
                var openingCapital = Math.min(0, stillInvestedValue - claimedFees / claimFactor);
                var currentYearClosing = currentYearAmounts.net + openingCapital;
                var periodForecast = function(period, year, closingBalance, periodHeritage) {
                    return {
                        days : Math.floor(period.days),
                        year,
                        heritage : formatForecastAmount(periodHeritage),
                        gross : formatForecastAmount(period.gross),
                        fees : formatForecastAmount(-period.fees),
                        tax : formatForecastAmount(-period.tax),
                        stamp : formatForecastAmount(-period.stamp),
                        cloud : formatForecastAmount(-cloudAnnual),
                        cumulativeSpendable : formatForecastAmount(closingBalance),
                        running : {
                            claimed : formatForecastAmount(period.afterClaimed),
                            gross : formatForecastAmount(period.afterGross),
                            fees : formatForecastAmount(period.afterFees),
                            tax : formatForecastAmount(period.afterTax),
                            stamp : formatForecastAmount(period.afterStamp),
                            cloud : formatForecastAmount(period.net)
                        }
                    };
                };
                var heritageScale = heritageRetention;
                var firstProjectedGrossDaily = grossDaily * heritageScale;
                var annualNet = amountsForPeriod(365, 0, 0, 0, 0, firstProjectedGrossDaily).net;
                var leapYearNet = amountsForPeriod(366, 0, 0, 0, 0, firstProjectedGrossDaily).net;
                var canRecover = currentYearClosing > 0 || canReachPositiveForecast(eoy.year, currentYearClosing, annualNet, leapYearNet);
                var periods = [periodForecast(currentYearAmounts, eoy.year, currentYearClosing, heritageValue)];
                var balance = currentYearClosing;
                var firstPositiveReached = balance > 0;
                var year = eoy.year + 1;
                for(; year <= 9999; year++) {
                    var period = amountsForPeriod(forecastYearDays(year), 0, 0, 0, Math.min(0, balance), grossDaily * heritageScale);
                    balance = period.net;
                    periods.push(periodForecast(period, year, balance, heritageValue * heritageScale));
                    if(firstPositiveReached || !canRecover) break;
                    firstPositiveReached = balance > 0;
                    heritageScale *= heritageRetention;
                    if(!firstPositiveReached && heritageRetention < 1) {
                        var nextLeapYear = amountsForPeriod(366, 0, 0, 0, 0, grossDaily * heritageScale);
                        canRecover = nextLeapYear.net > 0 && balance + nextLeapYear.gross / (1 - heritageRetention) > 0;
                        if(!canRecover) break;
                    }
                }
                var forecast = {
                    periods,
                    claimedFees : baseline !== null || monitoringDays === 0 ? formatForecastAmount(claimedFees) : null,
                    currentYearSpendable : formatForecastAmount(currentYearAmounts.net),
                    openingCapital : formatForecastAmount(openingCapital),
                    stillInvestedNow : formatForecastAmount(stillInvestedValue),
                    heritageRetention : formatForecastAmount(heritageRetention * 100),
                    capitalResult : formatForecastAmount(heritageValue - netProvided),
                    projectionNote : !canRecover ? 'Cumulative spendable cannot turn positive under this Heritage projection.' : year > 9999 ? 'The projection reaches the supported calendar limit.' : '',
                    grossDaily : formatForecastAmount(grossDaily),
                    feeDaily : formatForecastAmount(-feeDaily),
                    grossNote : grossInfo.estimate ? 'estimate since the monitoring start, measuring the last 28 days' + String.fromCharCode(0x2026) : '28 days to ' + utcLabel(grossInfo.end, true),
                    accruedNote : ' · currently claimable rewards + forecast to year end',
                    feeNote : feeInfo.estimate ? 'estimate, ' + (context.background && context.background.keeperFee && context.background.keeperFee.error ? 'measurement failed: ' + context.background.keeperFee.error + '; retrying in a minute' : 'measuring the last 7 UTC days' + String.fromCharCode(0x2026)) : 'measured over ' + feeInfo.days + ' UTC days, ' + utcLabel(feeInfo.end - 7 * 86400).replace(' UTC', '') + ' to ' + utcLabel(feeInfo.end - 86400),
                    readNote : customRead ? 'Measured on fixed UTC windows through the custom read RPC; every device shows the same figures.' : 'Measured on fixed UTC windows through the wallet RPC. Set a custom read RPC in Account on this device for faster, steadier figures.',
                    taxRateRewards,
                    taxRate,
                    stampDutyRate,
                    applyNet : net,
                    isOwner
                };
                if(isOwner) {
                    var hasInvestmentBasis = isFinite(netProvided) && netProvided > 0;
                    var yieldDaily = hasInvestmentBasis ? grossDaily / netProvided : 0;
                    forecast.whatIf = {
                        amount : whatIfAmount,
                        investmentBasis : hasInvestmentBasis ? formatForecastAmount(netProvided) : null,
                        yieldYear : formatForecastAmount(yieldDaily * 365 * 100),
                        heritageRetention : formatForecastAmount(heritageRetention * 100),
                        recoveryMonths : null,
                        backMonths : null,
                        backYear : null,
                        applyNet : net,
                        taxRate,
                        horizons : []
                    };
                    if(hasInvestmentBasis && whatIfAmount > 0 && isFinite(whatIfAmount)) {
                        var fees = feeDaily * 365;
                        var stamp = net ? whatIfAmount * stampDutyRate / 100 : 0;
                        var yearHeritage = whatIfAmount;
                        var spendable = -whatIfAmount;
                        var grossCapitalRemaining = whatIfAmount;
                        var whatIfYear;
                        var result;
                        for(whatIfYear = 1; whatIfYear <= 9999; whatIfYear++) {
                            var gross = (yearHeritage / netProvided) * (grossDaily * 365);
                            var tax = gross * taxRate / 100;
                            var afterFees = gross - fees;
                            var afterTax = afterFees - tax;
                            var afterStamp = afterTax - stamp;
                            result = afterStamp - cloudAnnual;
                            var afterRecovery = spendable >= 0;
                            var annualOpening = Math.min(spendable, 0);
                            spendable = result + annualOpening;
                            if(!afterRecovery && spendable >= 0) {
                                forecast.whatIf.backYear = whatIfYear;
                                forecast.whatIf.backMonths = Math.ceil((whatIfYear - 1) * 12 - annualOpening / result * 12);
                            }
                            if(grossCapitalRemaining > 0) {
                                var grossRecovery = gross / claimFactor;
                                if(grossRecovery >= grossCapitalRemaining) {
                                    forecast.whatIf.recoveryMonths = Math.ceil((whatIfYear - 1) * 12 + grossCapitalRemaining / grossRecovery * 12);
                                }
                                grossCapitalRemaining -= grossRecovery;
                            }
                            forecast.whatIf.horizons.push({
                                year : whatIfYear,
                                heritage : formatForecastAmount(yearHeritage),
                                gross : formatForecastAmount(gross),
                                fees : formatForecastAmount(-fees),
                                tax : formatForecastAmount(-tax),
                                stamp : formatForecastAmount(-stamp),
                                cloud : formatForecastAmount(-cloudAnnual),
                                net : formatForecastAmount(result),
                                running : {
                                    gross : formatForecastAmount(gross),
                                    fees : formatForecastAmount(afterFees),
                                    tax : formatForecastAmount(afterTax),
                                    stamp : formatForecastAmount(afterStamp),
                                    cloud : formatForecastAmount(result)
                                },
                                percent : formatForecastAmount(result / whatIfAmount * 100),
                                spendable : formatForecastAmount(spendable)
                            });
                            if(afterRecovery || (result <= 0 && whatIfYear >= 2)) break;
                            yearHeritage *= heritageRetention;
                        }
                        forecast.whatIf.projectionNote = whatIfYear > 9999 ? 'The projection reaches the supported year limit.' : forecast.whatIf.backMonths === null ? 'The initial investment cannot be recovered at the current rates.' : '';
                    }
                }

                var nextRebalance = timeRemaining(new Date((parseInt(claimRewardResult._nextRebalanceEvent) !== 0 ? endEvent : claimRewardResult._nextRebalanceEvent) * 1000));
                nextRebalance = `${[(nextRebalance.days && (nextRebalance.days + " day" + (nextRebalance.days === 1 ? "" : "s"))), (nextRebalance.hours && (nextRebalance.hours + " hour" + (nextRebalance.hours === 1 ? "" : "s"))), (nextRebalance.minutes && (nextRebalance.minutes + " minute" + (nextRebalance.minutes === 1 ? "" : "s")))].filter(it => it !== 0).join(', ')}`;
                nextRebalance = nextRebalance.split(' (-)').join('');

                return {
                    monitorStart : claimRewardResult.rewardTimestamp.toString() === '0' ? null : timeRemaining(new Date(parseInt(claimRewardResult.rewardTimestamp) * 1000), true),
                    monitorEnd : formatDate(new Date(segmentEnd * 1000)),
                    accruingResetDate: nextRebalance,
                    collectYear : formatForecastAmount(currentYearAmounts.net),
                    collectMonth : formatForecastAmount(monthly),
                    collectWeek : formatForecastAmount(weekly),
                    collectDay : formatForecastAmount(daily),
                    collectNow : formatMoney(fromDecimals(nextSeasonReward, referenceTokenDecimals, true), 4),
                    participationPercent : formatMoney(perc * 100, 2),
                    heritageValue : formatMoney(fromDecimals(heritage, referenceTokenDecimals, true), 2),
                    pnl : formatMoney(fromDecimals(profitAndLoss, referenceTokenDecimals, true), 2),
                    hasHeritage : heritage !== '0',
                    hasParticipation : perc !== 0 || stillInvested !== '0',
                    stillInvested : formatMoney(fromDecimals(stillInvested, referenceTokenDecimals, true), 4),
                    stillInvestedRaw : claimRewardResult.stillInvested.toString(),
                    alreadyCollected : formatMoney(fromDecimals(claimRewardResult.previouslyClaimedReward, referenceTokenDecimals, true), 2),
                    toBeCollected : formatMoney(fromDecimals(accruing.toString(), referenceTokenDecimals, true), 2),
                    pendingPayout : pendingPayout === '0' ? null : formatMoney(fromDecimals(pendingPayout, referenceTokenDecimals, true), 2),
                    eoy,
                    forecast
                };
            };

            var positions;
            var pendingKey = [from, referenceTokenAddress, blockNumber, claimRewardResult.participationPercentage].join('-');
            var initRefreshData = await summarize(context.pendingPayoutCache && context.pendingPayoutCache.key === pendingKey ? context.pendingPayoutCache.value : '0');

            if(!current()) return;
            context.view.emit('initRefresh', [positions, context.toRebalance.length !== 0, isOwner, claimableReward, initRefreshData]);

            var syncedPools = context.sortSynopticPools(await manager.methods.status(referenceTokenAddress, synopticConverted).call(undefined, blockNumber));
            if(!current()) return;
            if(claimRewardResult.participationPercentage.toString() !== '0') {
                try {
                    var convertedPools = synopticConverted ? syncedPools : await manager.methods.status(referenceTokenAddress, true).call(undefined, blockNumber);
                    if(!current()) return;
                    var pendingPayout = context.pendingPayout(convertedPools).mul(web3utils.toBN(claimRewardResult.participationPercentage)).div(web3utils.toBN(numberToString(1e18))).toString();
                    context.pendingPayoutCache = { key: pendingKey, value: pendingPayout };
                    initRefreshData = await summarize(pendingPayout);
                    if(!current()) return;
                    context.view.emit('initRefresh', [undefined, false, isOwner, claimableReward, initRefreshData]);
                } catch(e) {
                    console.log(e);
                }
            }
            if(isOwner && blockNumber === "latest") {
                try {
                    var syncIndices = await getSyncIndices(manager);
                    if(!current()) return;
                    context.toRebalance = syncIndices;
                } catch(e) {
                    console.log(e);
                }
            }
            positions = [];
            var s = web3utils.toBN(0);
            var a = web3utils.toBN(0);
            var p = web3utils.toBN(0);
            for(var item of syncedPools) {
                if(!current()) return;
                var token0 = item.token0Address;
                var meta0 = await fetchTokenMeta(token0);
                if(!current()) return;
                saveTokenMeta(meta0);
                var symbol0 = meta0.symbol;
                var decimals0 = meta0.decimals;
                var token1 = item.token1Address;
                var meta1 = await fetchTokenMeta(token1);
                if(!current()) return;
                saveTokenMeta(meta1);
                var symbol1 = meta1.symbol;
                var decimals1 = meta1.decimals;
                var position = {
                    index : item.index,
                    syncAvailable : context.toRebalance.includes(item.index.toString()),
                    poolAddress : item.poolAddress,
                    token0,
                    symbol0,
                    decimals0,
                    token1,
                    symbol1,
                    decimals1,
                    savedToken0Amount : item.savedAmount0,
                    savedToken1Amount : item.savedAmount1,
                    feeAmount0 : item.feeAmount0,
                    feeAmount1 : item.feeAmount1,
                    poolAmount0 : item.poolAmount0,
                    poolAmount1 : item.poolAmount1,
                    token0Amount : item.oldAmount0,
                    token1Amount : item.oldAmount1,
                    difference0 : item.difference0,
                    difference1 : item.difference1,
                    surplus0 : item.surplus0,
                    surplus1 : item.surplus1,
                    amountsConverted : synopticConverted,
                    referenceTokenAddress,
                    after0 : item.rebalancedAmount0,
                    after1 : item.rebalancedAmount1,
                    statusResult : item.rebalanceNeeded ? 2 : item.difference0.indexOf("-") !== -1 || item.difference1.indexOf("-") !== -1 ? 0 : item.surplus0 !== '0' || item.surplus1 !== '0' ? 1 : 0,
                    positionPrice : fromDecimals(item.positionPrice, referenceTokenDecimals, true),
                    currentPrice : fromDecimals(item.currentPrice, referenceTokenDecimals, true),
                    prices : [
                        fromDecimals(item.leftBound, referenceTokenDecimals, true),
                        0,0,0,0,
                        fromDecimals(item.rightBound, referenceTokenDecimals, true)
                    ]
                };
                if(parseFloat(position.prices[0]) > parseFloat(position.prices[position.prices.length - 1])) {
                    position.prices = position.prices.reverse();
                }
                (positions = positions || []).push(position);
                var saved = web3utils.toBN(position.savedToken0Amount).add(web3utils.toBN(position.savedToken0Amount));
                s = s.add(saved);
                var after = web3utils.toBN(position.after0).add(web3utils.toBN(position.after1));
                a = a.add(after);
                var pool = web3utils.toBN(position.token0Amount).add(web3utils.toBN(position.token1Amount));
                p = p.add(pool);
                //console.log(position.index, position.poolAddress, fromDecimals(saved.toString(), referenceTokenDecimals), fromDecimals(pool.toString(), referenceTokenDecimals), fromDecimals(after.toString(), referenceTokenDecimals), fromDecimals(saved.sub(pool).toString(), referenceTokenDecimals), fromDecimals(saved.sub(after).toString(), referenceTokenDecimals));
            }

            //console.log(fromDecimals(s.toString(), referenceTokenDecimals), fromDecimals(p.toString(), referenceTokenDecimals), fromDecimals(a.toString(), referenceTokenDecimals), fromDecimals(p.sub(s).toString(), referenceTokenDecimals), fromDecimals(a.sub(s).toString(), referenceTokenDecimals));

            if(!current()) return;
            context.view.emit('initRefresh', [positions, context.toRebalance.length !== 0, isOwner]);

        } catch(e) {
            console.log(e);
        }
        if(current()) context.timeout = setTimeout(context.init, timeoutLimit);
    };

    async function call(to, method) {
        var args = [];
        for(var i in arguments) {
            if(parseInt(i) < 2) {
                continue;
            }
            args.push(arguments[i]);
        }
        if(method[method.length - 1] !== ')') {
            method += '()';
        }
        var data = web3utils.sha3(method).substring(0, 10);
        if(method[method.length - 2] !== '(') {
            var argsList = method.split('(')[1];
            argsList = argsList.substring(0, argsList.length - 1);
            argsList = argsList.split(',');
            data += abi.encode(argsList, args).substring(2);
            args = args.splice(argsList.length + 1);
        }
        var callOptions = {
            to,
            data
        };
        args.length != 0 && (callOptions.from = args[args.length - 1]);
        var response = await web3.currentProvider.request({
            method: 'eth_call',
            params: [callOptions, 'latest']
        });
        return response;
    }

    function timeRemaining(targetDate, elapsed) {
        var diff = targetDate.getTime() - new Date().getTime();
        if (diff <= 0 && !elapsed) return { days: 0, hours: 0, minutes: 0 };
        var minutes = Math.floor(Math.abs(diff) / 60000);
        var days = Math.floor(minutes / 1440);
        minutes -= days * 1440;
        var hours = Math.floor(minutes / 60);
        minutes -= hours * 60;
        return { targetDate, days, hours, minutes, targetDateFormatted : formatDate(targetDate) };
    }

    function dateInfo(d, beforeSeconds){
        var before = new Date(d.getTime() - (parseInt(beforeSeconds) * 1000));
        var now = new Date();
        var daysPassed = (now.getTime() - before.getTime()) / (24 * 60 * 60 * 1000);
        return {
            original : d,
            before,
            daysPassed
        };
    }

    function formatDate(dateInput) {
        if(!dateInput) {
            return 'Unknown';
        }

        var localDate = dateInput;
        //localDate = new Date(localDate.getTime() + (dateInput.getTimezoneOffset() * 60000));

        var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        var dd = String(localDate.getDate()).padStart(2,"0");
        var mm = String(localDate.getMonth() + 1).padStart(2,"0");
        var yyyy = localDate.getFullYear();
        var hh = String(localDate.getHours()).padStart(2,"0");
        var min = String(localDate.getMinutes()).padStart(2,"0");
        return days[localDate.getDay()] + ", " + dd + "/" + mm + "/" + yyyy + " " + hh + ":" + min;
    }

    function readRate(name, fallback) {
        var value = parseFloat(window.localStorage.getItem(name));
        return isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
    }

    function horizonOf(timestamp) {
        var now = timestamp * 1000;
        var day = 24 * 60 * 60 * 1000;
        var year = new Date(now).getUTCFullYear();
        return { days : Math.max(0, (Date.UTC(year + 1, 0, 1) - now) / day), hours : 0, minutes : 0, year };
    }

    function formatForecastAmount(value) {
        return formatMoney(Math.floor(value), 0);
    }

    function forecastYearDays(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
    }

    function canReachPositiveForecast(year, balance, annualNet, leapYearNet) {
        if(!isFinite(balance) || !isFinite(annualNet) || !isFinite(leapYearNet)) return false;
        if(303 * annualNet + 97 * leapYearNet > 0) return true;
        for(var offset = 1; offset <= 400; offset++) {
            balance += forecastYearDays(year + offset) === 366 ? leapYearNet : annualNet;
            if(balance > 0) return true;
        }
        return false;
    }

    function readStored(key) {
        try {
            return JSON.parse(window.localStorage.getItem(key));
        } catch(e) {
            return null;
        }
    }

    function runInBackground(name, task) {
        context.background = context.background || {};
        var state = context.background[name] = context.background[name] || {};
        if(state.running || Date.now() - (state.failedAt || 0) < 60000) return;
        state.running = true;
        setTimeout(async () => {
            try {
                await task();
                state.error = null;
                context.init();
            } catch(e) {
                state.failedAt = Date.now();
                state.error = (e && e.message) || String(e);
                context.init();
                console.log(e);
            } finally {
                state.running = false;
            }
        }, 2000);
    }

    async function blockAt(timestamp, session) {
        if(session) ensureLiquidityForecastSession(session);
        var key = networkStorageKey('blockAt:' + timestamp);
        var cached = readStored(key);
        if(cached && isFinite(cached.number)) return cached;
        var read = async number => {
            if(session) ensureLiquidityForecastSession(session);
            var block = await web3.eth.getBlock(number);
            if(session) ensureLiquidityForecastSession(session);
            return { number : parseInt(block.number), timestamp : parseInt(block.timestamp) };
        };
        var high = await read('latest');
        if(high.timestamp < timestamp) throw new Error('Block at ' + timestamp + ' not produced yet');
        var genesisKey = networkStorageKey('genesisBlock');
        var low = readStored(genesisKey);
        if(!low || !isFinite(low.timestamp)) {
            low = await read(0);
            window.localStorage.setItem(genesisKey, JSON.stringify(low));
        }
        if(low.timestamp >= timestamp) return low;
        for(var step = 0; step < 48 && high.number - low.number > 1; step++) {
            var guess = step % 3 === 2 ? Math.floor((low.number + high.number) / 2) : Math.round(low.number + (timestamp - low.timestamp) * (high.number - low.number) / Math.max(1, high.timestamp - low.timestamp));
            var found = await read(Math.min(high.number - 1, Math.max(low.number + 1, guess)));
            if(found.timestamp >= timestamp) {
                high = found;
            } else {
                low = found;
            }
        }
        if(high.number - low.number > 1) throw new Error('Block at ' + timestamp + ' not found');
        window.localStorage.setItem(key, JSON.stringify(high));
        return high;
    }

    async function measureGrossDailyRate(manager, from, outputTokenAddress, outputTokenDecimals, endTimestamp) {
        var end = await blockAt(endTimestamp);
        var start = await blockAt(endTimestamp - 28 * 86400);
        var current = await manager.methods.claimReward(outputTokenAddress).call({ from }, end.number - 1);
        var past = await manager.methods.claimReward(outputTokenAddress).call({ from }, start.number - 1);
        var since = Math.max(endTimestamp - 28 * 86400, parseInt(current.lastAddedLiquidity) || 0);
        return parseFloat(fromDecimals(grossRewardTotal(current).sub(grossRewardTotal(past)).toString(), outputTokenDecimals, true)) * 86400 / Math.max(3600, endTimestamp - since);
    }

    function grossRewardTotal(result) {
        return web3utils.toBN(result.previouslyClaimedReward).add(web3utils.toBN(result.claimedReward));
    }

    async function claimedFeesBaseline(manager, from, outputTokenAddress, started, blockNumber) {
        var key = networkStorageKey(['claimedFeesBaseline', manager.options.address, from, outputTokenAddress, started].join(':').toLowerCase());
        var cached = readStored(key);
        if(typeof cached === 'string' && /^\d+$/.test(cached)) return cached;
        var measure = async function() {
            var start = await blockAt(started);
            var snapshot = start.number === 0 ? null : await manager.methods.claimReward(outputTokenAddress).call({ from }, start.number - 1);
            var baseline = snapshot ? snapshot.previouslyClaimedReward.toString() : '0';
            window.localStorage.setItem(key, JSON.stringify(baseline));
            return baseline;
        };
        if(blockNumber === 'latest') {
            runInBackground(key, measure);
        } else {
            try {
                return await measure();
            } catch(e) {
                console.log(e);
            }
        }
        return null;
    }

    function sinceStartRate(current, outputTokenDecimals, blockTimestamp) {
        var started = parseInt(current.rewardTimestamp);
        return started === 0 ? 0 : parseFloat(fromDecimals(grossRewardTotal(current).toString(), outputTokenDecimals, true)) * 86400 / Math.max(3600, blockTimestamp - started);
    }

    async function storeGrossRate(manager, from, outputTokenAddress, outputTokenDecimals, end) {
        var base = 'grossRate:' + from.toLowerCase() + ':' + outputTokenAddress.toLowerCase();
        var value = await measureGrossDailyRate(manager, from, outputTokenAddress, outputTokenDecimals, end);
        window.localStorage.setItem(networkStorageKey(base + ':' + end), JSON.stringify({ value }));
        var last = readStored(networkStorageKey(base));
        if(!last || !isFinite(last.end) || last.end < end) window.localStorage.setItem(networkStorageKey(base), JSON.stringify({ end, value }));
        return value;
    }

    async function grossDailyRate(manager, from, outputTokenAddress, outputTokenDecimals, current, blockNumber, blockTimestamp) {
        var end = Math.floor(blockTimestamp / 3600) * 3600;
        var base = 'grossRate:' + from.toLowerCase() + ':' + outputTokenAddress.toLowerCase();
        var stored = readStored(networkStorageKey(base + ':' + end));
        if(stored && isFinite(stored.value)) {
            context.grossInfo = { end, estimate : false };
            return stored.value;
        }
        if(blockNumber !== 'latest') {
            try {
                var value = await storeGrossRate(manager, from, outputTokenAddress, outputTokenDecimals, end);
                context.grossInfo = { end, estimate : false };
                return value;
            } catch(e) {
                context.grossInfo = { end, estimate : true };
                return sinceStartRate(current, outputTokenDecimals, blockTimestamp);
            }
        }
        runInBackground('grossRate', () => storeGrossRate(manager, from, outputTokenAddress, outputTokenDecimals, end));
        var last = readStored(networkStorageKey(base));
        if(last && isFinite(last.end) && isFinite(last.value)) {
            context.grossInfo = { end : last.end, estimate : false };
            return last.value;
        }
        context.grossInfo = { end, estimate : true };
        return sinceStartRate(current, outputTokenDecimals, blockTimestamp);
    }

    var wasHidden;
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    function handleVisibility() {
        if(document.visibilityState === 'hidden' && !wasHidden) {
            return wasHidden = true;
        }
        if(document.visibilityState === 'visible' && wasHidden) {
            wasHidden = false;
            context.init();
        }
    }

    async function convertFromEUR(amount, outputTokenAddress, outputTokenDecimals) {
        amount = parseFloat(amount);
        var inputToken = getStoredTokenMeta();
        if(Object.values(inputToken).filter(it => it.symbol.toUpperCase().indexOf('EUR') !== -1).length === 0) {
            amount /= 0.85;
            inputToken = Object.values(inputToken).find(it => it.symbol.toUpperCase().indexOf('USD') !== -1);
        } else {
            inputToken = Object.values(inputToken).find(it => it.symbol.toUpperCase().indexOf('EUR') !== -1);
        }
        if(web3utils.toChecksumAddress(inputToken.address) === web3utils.toChecksumAddress(outputTokenAddress)) {
            return amount;
        }
        amount = toDecimals(amount, inputToken.decimals);
        var outputAmount = await context.getManager().methods.convert(voidEthereumAddress, inputToken.address, amount, outputTokenAddress).call();
        outputAmount = fromDecimals(outputAmount, outputTokenDecimals, true);
        return parseFloat(outputAmount);
    }

    async function managerLogs(topics, fromBlock, toBlock, session) {
        var key = networkStorageKey('logChunk');
        var chunk = parseInt(window.localStorage.getItem(key)) || 50000;
        var logs = [];
        var start = fromBlock;
        while(start <= toBlock) {
            if(session) ensureLiquidityForecastSession(session);
            var end = Math.min(toBlock, start + chunk - 1);
            try {
                logs = logs.concat(await web3.eth.getPastLogs({ address : window.context.managerAddress, topics, fromBlock : web3utils.numberToHex(start), toBlock : web3utils.numberToHex(end) }));
                start = end + 1;
            } catch(e) {
                if(chunk <= 2000 || e.revert) throw e;
                chunk = Math.floor(chunk / 5);
                window.localStorage.setItem(key, String(chunk));
            }
        }
        return logs;
    }

    async function keeperDay(owner, dayStart) {
        var key = networkStorageKey('keeperDay:' + owner.toLowerCase() + ':' + dayStart);
        var stored = readStored(key);
        if(stored && typeof stored.valid === 'boolean') return stored;
        var start = await blockAt(dayStart);
        var end = await blockAt(dayStart + 86400);
        var values = await Promise.all([
            web3.eth.getBalance(owner, start.number - 1),
            web3.eth.getBalance(owner, end.number - 1),
            web3.eth.getTransactionCount(owner, start.number - 1),
            web3.eth.getTransactionCount(owner, end.number - 1),
            managerLogs([web3utils.sha3('RewardClaimed(address,address,uint256,uint256,uint256)'), web3.eth.abi.encodeParameter('address', owner)], start.number, end.number - 1)
        ]);
        var spent = web3utils.toBN(String(values[0])).sub(web3utils.toBN(String(values[1])));
        for(var log of values[4]) {
            var decoded = web3.eth.abi.decodeParameters(['uint256', 'uint256', 'uint256'], log.data);
            spent = spent.add(web3utils.toBN(String(decoded[2])));
            if(web3utils.toBN(log.topics[2]).isZero()) spent = spent.add(web3utils.toBN(String(decoded[1])));
        }
        var transactions = parseInt(values[3]) - parseInt(values[2]);
        var day = { spent : spent.toString(), transactions, valid : !spent.isNeg() && spent.lte(web3utils.toBN(transactions).mul(web3utils.toBN('1000000000000000'))) };
        window.localStorage.setItem(key, JSON.stringify(day));
        return day;
    }

    async function storeKeeperFee(owner, today, outputTokenAddress, outputTokenDecimals) {
        var records = await Promise.all([7, 6, 5, 4, 3, 2, 1].map(index => keeperDay(owner, today - index * 86400)));
        var valid = records.filter(record => record.valid);
        if(!valid.length) throw new Error('No valid keeper fee day in the window');
        var spent = valid.reduce((total, record) => total.add(web3utils.toBN(record.spent)), web3utils.toBN(0));
        var end = await blockAt(today);
        var converted = await context.getManager().methods.convert(voidEthereumAddress, voidEthereumAddress, spent.toString(), outputTokenAddress).call(undefined, end.number - 1);
        var value = parseFloat(fromDecimals(converted, outputTokenDecimals, true)) / valid.length;
        var base = 'keeperFee:' + owner.toLowerCase() + ':' + outputTokenAddress.toLowerCase();
        window.localStorage.setItem(networkStorageKey(base + ':' + today), JSON.stringify({ value, days : valid.length }));
        var last = readStored(networkStorageKey(base));
        if(!last || !isFinite(last.end) || last.end < today) window.localStorage.setItem(networkStorageKey(base), JSON.stringify({ end : today, value, days : valid.length }));
        return value;
    }

    async function keeperDailyFee(owner, blockTimestamp, outputTokenAddress, outputTokenDecimals) {
        var today = Math.floor(blockTimestamp / 86400) * 86400;
        var base = 'keeperFee:' + owner.toLowerCase() + ':' + outputTokenAddress.toLowerCase();
        var stored = readStored(networkStorageKey(base + ':' + today));
        if(stored && isFinite(stored.value)) {
            context.feeInfo = { end : today, days : stored.days, estimate : false };
            return stored.value;
        }
        runInBackground('keeperFee', () => storeKeeperFee(owner, today, outputTokenAddress, outputTokenDecimals));
        var last = readStored(networkStorageKey(base));
        if(last && isFinite(last.end) && isFinite(last.value)) {
            context.feeInfo = { end : last.end, days : last.days, estimate : false };
            return last.value;
        }
        context.feeInfo = { end : today, estimate : true };
        return await convertFromEUR(2.31, outputTokenAddress, outputTokenDecimals);
    }
};
