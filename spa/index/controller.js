var IndexController = function(view) {
    var context = this;
    context.view = view;

    context.refreshBalance = async function refreshBalance() {
        if(!web3?.currentProvider || !context?.view?.state?.walletAddress || context?.view?.state?.mode === 'none' || !context.view.state[context?.view?.state?.mode + "TokenAddress"]) {
            return context?.view?.setState({balance : null, allowance : null});
        }
        var from = context.view.state.walletAddress;
        var tokenAddress = context.view.state[context.view.state.mode + "TokenAddress"];
        var balance = '0';
        var allowance = '0';
        if(tokenAddress === voidEthereumAddress) {
            allowance = balance = await web3.eth.getBalance(from);
        } else {
            balance = abi.decode(["uint256"], await call(tokenAddress, "balanceOf(address)", from))[0].toString();
            allowance = abi.decode(["uint256"], await call(tokenAddress, "allowance(address,address)", from, window.context.managerAddress))[0].toString();
        }
        context?.view?.setState({balance, allowance});
    }

    context.approveForAddLiquidity = function approveForAddLiquidity(address, value) {
        return prepareAndSendTx((new web3.eth.Contract(window.context.IERC20ABI, address)).methods.approve(window.context.managerAddress, value), {
            returnReceipt : true,
            throwError : true
        });
    }

    context.addLiquidity = function addLiquidity(address, value) {
        return prepareAndSendTx(context.manager.methods.addLiquidity(address, value, context.view.state.referenceTokenAddress), {
            returnReceipt : true,
            throwError : true,
            value : address === voidEthereumAddress ? value : "0"
        });
    }

    context.removeLiquidity = function removeLiquidity(address, value, readonly) {
        var method = context.manager.methods.removeLiquidity(value, address);
        return readonly ? method.call({from : context.view.state.walletAddress}) : prepareAndSendTx(method);
    }

    context.rebalance = function rebalance() {
        return prepareAndSendTx(context.manager.methods.pools(context.toRebalance));
    }

    context.claimReward = function claimReward() {
        return prepareAndSendTx(context.manager.methods.claimReward(context.view.state.referenceTokenAddress));
    }

    async function prepareAndSendTx(method, options = {}) {
        context.timeout && clearTimeout(context.timeout);
        var account = context.view.state.walletAddress;
        var tx = {
            from : account
        };
        options.value !== '0' && (tx.value = options.value);
        var gas = await method.estimateGas(tx);
        gas = parseInt(gas) * 1.3;
        gas = parseInt(gas);
        gas = numberToString(gas);
        gas = web3.utils.numberToHex(gas);
        tx = {
            ...tx,
            to: method._parent.options.address,
            data: method.encodeABI(),
            gas,
            gasPrice: await web3.eth.getGasPrice()
        };
        try {
            var receipt = await web3.eth.sendTransaction(tx);
            console.log(receipt);
            context.init();
            if(options.returnReceipt) {
                await new Promise(ok => setTimeout(ok, 2000));
                return receipt;
            } else {
                window.open('https://basescan.org/tx/' + receipt.transactionHash, '_blank');
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

    context.init = async function init() {
        context.timeout && clearTimeout(context.timeout);
        var timeoutLimit = 10000;
        if(!web3?.currentProvider || !context?.view?.state?.walletAddress || !context?.view?.state?.referenceTokenAddress) {
            return context.timeout = setTimeout(context.init, timeoutLimit);
        }
        try {
            context.manager = context.manager || new web3.eth.Contract(window.context.ManagerABI, window.context.managerAddress);
            var from = web3util.utils.toChecksumAddress(context.view.state.walletAddress);
            context.toRebalance = [];
            var manager = context.manager;
            var referenceTokenAddress = context.view.state.referenceTokenAddress;
            var referenceToken = getTokenMetaByAddress(referenceTokenAddress);
            var referenceTokenDecimals = referenceToken.decimals;
            var referenceTokenTicker = referenceToken.symbol;
            var isOwner = web3util.utils.toChecksumAddress(await manager.methods.owner().call()) === from;
            var claimRewardResult = await manager.methods.claimReward(referenceTokenAddress).call({from});

            var perc = parseFloat(fromDecimals(claimRewardResult.participationPercentage, 18, true));

            var synopticConverted = window.localStorage.synopticConverted === 'true'

            var globalStatus = await manager.methods.status(referenceTokenAddress, synopticConverted).call();
            var nextSeasonReward = globalStatus.nextSeasonReward;
            nextSeasonReward = parseInt(nextSeasonReward) * perc;
            nextSeasonReward = numberToString(nextSeasonReward).split('.')[0];
            
            var nextRebalanceDate = new Date(claimRewardResult._nextRebalanceEvent * 1000);
            var nextRebalance = timeRemaining(nextRebalanceDate);
            var nextSeasonDate = formatDate(nextRebalance.targetDate);
            nextRebalance = `${[(nextRebalance.days && (nextRebalance.days + " day" + (nextRebalance.days === 1 ? "" : "s"))), (nextRebalance.hours && (nextRebalance.hours + " hour" + (nextRebalance.hours === 1 ? "" : "s"))), (nextRebalance.minutes && (nextRebalance.minutes + " minute" + (nextRebalance.minutes === 1 ? "" : "s")))].filter(it => it !== 0).join(', ')}`;
            nextRebalance = nextRebalance.split(' (-)').join('');

            var claimableReward = claimRewardResult.claimedReward;
            var profitAndLoss = claimRewardResult.updatedProfitAndLoss;
            var heritage = '0';
            if(claimRewardResult.participationPercentage !== '0') {
                var removeLiquidityResult = await manager.methods.removeLiquidity(numberToString(1e18), referenceTokenAddress).call({from});
                claimableReward = removeLiquidityResult.claimedReward;
                profitAndLoss = removeLiquidityResult.updatedProfitAndLoss;
                heritage = removeLiquidityResult.removedAmount;
            }

            var daily = parseFloat(fromDecimals(nextSeasonReward, referenceTokenDecimals, true));
            nextRebalanceDate = dateInfo(nextRebalanceDate, parseInt(globalStatus.nextRebalanceEvent) - parseInt(globalStatus.seasonStart));
            daily /= nextRebalanceDate.daysPassed;
            var end = toEnd();
            var weekly = daily * 7 * (end.weeks < 1 ? end.weeks : 1);
            var monthly = daily * 30 * (end.months < 1 ? end.months : 1);
            var yearly = daily * end.days;

            var positions = [];

            for(var item of globalStatus.syncedPools) {
                item.rebalanceNeeded && context.toRebalance.push(item.index);
                var token0 = item.token0Address;
                var symbol0 = abi.decode(["string"], await call(token0, "symbol"))[0];
                var decimals0 = abi.decode(["uint8"], await call(token0, "decimals"))[0];
                var token1 = item.token1Address;
                var symbol1 = abi.decode(["string"], await call(token1, "symbol"))[0];
                var decimals1 = abi.decode(["uint8"], await call(token1, "decimals"))[0];
                var position = {
                    poolAddress : item.poolAddress,
                    token0,
                    symbol0,
                    decimals0,
                    token1,
                    symbol1,
                    decimals1,
                    savedToken0Amount : item.savedAmount0,
                    savedToken1Amount : item.savedAmount1,
                    token0Amount : item.oldAmount0,
                    token1Amount : item.oldAmount1,
                    difference0 : item.difference0,
                    difference1 : item.difference1,
                    surplus0 : item.surplus0,
                    surplus1 : item.surplus1,
                    after0 : item.rebalancedAmount0,
                    after1 : item.rebalancedAmount1,
                    statusResult : !item.rebalanceNeeded ? 0 : item.surplus0 !== '0' || item.surplus1 !== '0' ? 1 : 2,
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
                positions.push(position);
            }

            context.view.emit('initRefresh', [positions, context.toRebalance.length !== 0, isOwner, claimableReward, {
                nextSeasonTimeout: nextRebalance,
                nextSeasonDate,
                lastAddedLiquidity : formatDate(end.startDate),
                endDate : formatDate(end.endDate),
                collectYear : formatMoney(yearly),
                collectMonth : formatMoney(monthly),
                collectWeek : formatMoney(weekly),
                collectDay : formatMoney(daily),
                collectNow : formatMoney(fromDecimals(nextSeasonReward, referenceTokenDecimals, true), 4),
                participationPercent : formatMoney(perc * 100, 2),
                heritageValue : formatMoney(fromDecimals(heritage, referenceTokenDecimals, true), 2),
                pnl : formatMoney(fromDecimals(profitAndLoss, referenceTokenDecimals, true), 2),
                hasHeritage : heritage !== '0',
                hasParticipation : perc !== 0
            }]);

        } catch(e) {
            console.log(e);
        }
        return void(context.timeout = setTimeout(context.init, timeoutLimit));
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
        var data = web3.utils.sha3(method).substring(0, 10);
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
        var response = await web3.eth.call(callOptions);
        return response;
    }

    function timeRemaining(targetDate) {
        var diff = targetDate.getTime() - new Date().getTime();
        if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
        var minutes = Math.floor(diff / 60000);
        var days = Math.floor(minutes / 1440);
        minutes -= days * 1440;
        var hours = Math.floor(minutes / 60);
        minutes -= hours * 60;
        return { targetDate, days, hours, minutes };
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
            return 'Unknonw';
        }
        var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        var dd = String(dateInput.getDate()).padStart(2,"0");
        var mm = String(dateInput.getMonth() + 1).padStart(2,"0");
        var yyyy = dateInput.getFullYear();
        var hh = String(dateInput.getHours()).padStart(2,"0");
        var min = String(dateInput.getMinutes()).padStart(2,"0");
        return days[dateInput.getDay()] + ", " + dd + "/" + mm + "/" + yyyy + " " + hh + ":" + min;
    }

    function toEnd(timestamp) {
        var startDate = (timestamp = parseInt(timestamp || 0)) !== 0 ? new Date(timestamp * 1000) : new Date();
        var endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        var diff = endDate.getTime() - startDate.getTime();
        var denominator = 24 * 60 * 60 * 1000;
        return {
            startDate,
            endDate,
            days : Math.ceil(diff / denominator),
            weeks : Math.ceil(diff / (denominator * 7)),
            months : Math.ceil(diff / (denominator * 30.44))
        }
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
};