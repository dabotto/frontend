var Index = React.createClass({
    requiredScripts: [
        "spa/components/Disclaimer.jsx",
        "spa/components/HowItWorks.jsx",
        "spa/components/WalletCard.jsx",
        "spa/components/ClaimRewardCard.jsx",
        "spa/components/ModeSelector.jsx",
        "spa/components/AddLiquidityCard.jsx",
        "spa/components/ReferralsCard.jsx",
        "spa/components/RemoveLiquidityCard.jsx",
        "spa/components/TokenPickerModal.jsx",
        "spa/components/PositionStatusSynopsis.jsx",
        "spa/components/ConsoleCard.jsx"
    ],
    getDefaultSubscriptions() {
        return {
            'initRefresh' : this.initRefresh
        }
    },
    getInitialState: function() {
        return {
            showDisclaimer : sessionStorage.disclaimerAccepted !== 'true',
            showHowItWorks : false,
            walletAddress: "",
            mode: "addLiquidity",
            referenceTokenAddress: readNetworkPreference("referenceTokenAddress") || getAppNetwork().referenceTokenAddress,
            addLiquidityTokenAddress: readNetworkPreference("addLiquidityTokenAddress") || voidEthereumAddress,
            approvedTokens: {
            },
            tokenPickerOpen: false,
            tokenPickerContext: "claimReward",
            tokenCacheVersion: 0,
            toast: "",
            balance : null,
            removePercent : "0",
            synopticConverted : localStorage.synopticConverted === 'true',
            forecastIn12Months : localStorage.forecastIn12Months === 'true',
            net : localStorage.net === 'true'
        };
    },
    toggleLocalStorageVar(name) {
        var self = this;
        this.setState({[name] : !this.state[name]}, () => {
            localStorage.setItem(name, self.state[name] ? 'true' : 'false');
            self.controller.init();
        });
    },
    bumpTokenCache: function() {
        this.setState({ tokenCacheVersion: Date.now() });
    },
    onWallet: function(walletAddress) {
        var self = this;
        if(!walletAddress) {
            clearTimeout(this.removeLiquidityTimeout);
            clearTimeout(this.controller.timeout);
            this.controller.manager = null;
            this.controller.toRebalance = [];
            return this.setState({ walletAddress: '', approvedTokens: {}, balance: null, allowance: null, positions: [], summary: null, claimableValue: null, rebalance: false, isOwner: false, amountToBeRemoved: null, tokenPickerOpen: false, toast: '' });
        }
        var session = requireWalletSession();
        self.setState({ walletAddress }, function() {
            ensureDefaultTokenCache(function() {
                if(!session.active) return;
                self.bumpTokenCache();
                self.controller.refreshBalance();
                self.controller.init();
            });
        });
    },
    openTokenPicker: function(context) {
        this.setState({
            tokenPickerOpen: true,
            tokenPickerContext: context
        });
    },
    closeTokenPicker: function() {
        this.setState({ tokenPickerOpen: false });
    },
    handleTokenSelected: function(address) {
        var next = { tokenPickerOpen: false };
        var key = (this.state.tokenPickerContext === 'addLiquidity' ? 'addLiquidity' : 'reference') + "TokenAddress";
        writeNetworkPreference(key, next[key] = address);
        this.setState(next, this.state.tokenPickerContext !== 'addLiquidity' ? this.controller.init : this.controller.refreshBalance);
    },
    handleCustomTokensChanged: function() {
        this.bumpTokenCache();
    },
    approveToken(address, value) {
        var self = this;
        address = web3util.utils.toChecksumAddress(address);
        var toast;
        var session = requireWalletSession();
        var next = Object.assign({}, this.state.approvedTokens);
        this.controller.approveForAddLiquidity(address, value)
        .then(() => {
            toast = "Approval ready. You can add liquidity now.";
            next[address] = true;
        })
        .catch(e => toast = e.message)
        .finally(() => {        
            if(!session.active) return;
            self.setState({ approvedTokens: next, toast });
            setTimeout(function() {
                self.setState({ toast: "" });
            }, 2200);
        });
    },
    addLiquidity(address, value, subject) {
        var self = this;
        address = web3util.utils.toChecksumAddress(address);
        var toast;
        var session = requireWalletSession();
        var next = Object.assign({}, this.state.approvedTokens);
        this.controller.addLiquidity(address, value, subject)
        .then(() => {
            toast = "The beneficiary's farming position has been increased.";
            next[address] = false;
        })
        .catch(e => toast = e.message)
        .finally(() => {        
            if(!session.active) return;
            self.setState({ approvedTokens: next, toast });
            setTimeout(function() {
                self.setState({ toast: "" });
            }, 2200);
        });
    },
    removeLiquidity : function(address, removePercent, readonly) {
        var self = this;
        var session = window.walletSession;
        if(!session || !session.active) return;
        this.setState({amountToBeRemoved : readonly ? null : this.state.amountToBeRemoved, removePercent}, function() {
            self.removeLiquidityTimeout && clearTimeout(self.removeLiquidityTimeout);
            parseFloat(removePercent) != 0 && (self.removeLiquidityTimeout = setTimeout(() => self.controller.removeLiquidity(address, toDecimals(removePercent, 16), readonly).then(result => {
                session.active && readonly && this.setState({amountToBeRemoved : result.removedAmount});
            }).catch(error => session.active && self.setState({toast: error.message})), readonly ? 700 : 0));
        });
    },
    setMode: function(mode) {
        this.setState({ mode: mode, balance : null }, this.controller.refreshBalance);
    },
    initRefresh(result) {
        if(!result || !window.walletSession || !window.walletSession.active) {
            return;
        }
        var [positions, rebalance, isOwner, claimableValue, summary] = result;
        var next = {
            isOwner
        };
        positions && (next.positions = positions);
        positions && (next.rebalance = rebalance);
        claimableValue && (next.claimableValue = claimableValue);
        summary && (next.summary = summary);
        var self = this;
        this.setState(next, () => {
            self.controller.refreshBalance();
            self.removeLiquidity(self.state.referenceTokenAddress, self.state.removePercent, true);
        });
    },
    toggleDisclaimer() {
        this.setState({showDisclaimer : !this.state.showDisclaimer}, () => window.sessionStorage.setItem('disclaimerAccepted', 'true'));
    },
    toggleHowItWorks() {
        this.setState({showHowItWorks : !this.state.showHowItWorks});
    },
    render: function() {

        var referenceToken = getTokenMetaByAddress(this.state.referenceTokenAddress);
        var addToken = getTokenMetaByAddress(this.state.addLiquidityTokenAddress);

        return (
            <div className = "dashboard-shell">
                <div className = "app-stack">
                    {this.state.showHowItWorks ? <HowItWorks onDismiss={this.toggleHowItWorks}/> : this.state.showDisclaimer ? <Disclaimer onDismiss={this.toggleDisclaimer} onHowItWorks={this.toggleHowItWorks}/> : <>
                        <div className = "glass-card card-pad">
                            <div className = "card-header">
                                <button className = "button-base button-primary" onClick={this.toggleHowItWorks}>
                                    <i className = "fa-solid fa-cog"></i>
                                    How it works
                                </button>
                                <button className = "button-base button-primary" onClick={this.toggleDisclaimer}>
                                    <i className = "fa-solid fa-legal"></i>
                                    Disclaimer
                                </button>
                            </div>
                        </div>
                        <ConsoleCard/>
                        <WalletCard
                            walletAddress = {this.state.walletAddress}
                            onWallet = {this.onWallet}
                        />
                        {this.state.walletAddress ? (<>
                            <ClaimRewardCard
                                token = {referenceToken}
                                claimableValue = {this.state.claimableValue}
                                summary = {this.state.summary}
                                onOpenPicker = {this.openTokenPicker.bind(this)}
                                onClaimReward = {this.controller.claimReward}
                                forecastIn12Months = {this.state.forecastIn12Months}
                                toggleForecastIn12Months = {() => this.toggleLocalStorageVar("forecastIn12Months")}
                                net = {this.state.net}
                                toggleNet = {() => this.toggleLocalStorageVar("net")}
                                isOwner={this.state.isOwner}
                            />
                            {referenceToken ? <div className = "glass-card card-pad">
                                <div className = "card-header">
                                    <div>
                                        <h2 className = "card-title">Manage your participation</h2>
                                        <div className = "card-copy">{this.state?.summary?.hasParticipation ? "Add more liquidity through your favorite token or decrease your participation" : "Start collecting reward by adding liquidity"}.</div>
                                    </div>
                                </div>
                                <ModeSelector mode={this.state.mode} onChange={this.setMode} removeDisabled={this.state?.summary?.hasHeritage === false}/>
                                {this.state.mode === "addLiquidity" ? (
                                    <AddLiquidityCard
                                        key = {this.state.walletAddress}
                                        isOwner = {this.state.isOwner}
                                        walletAddress = {this.state.walletAddress}
                                        token = {addToken}
                                        balance = {this.state.balance}
                                        allowance = {this.state.allowance}
                                        approvedTokens = {this.state.approvedTokens}
                                        onOpenPicker = {this.openTokenPicker.bind(this)}
                                        onApprove = {this.approveToken}
                                        toast = {this.state.toast}
                                        onAddLiquidity = {this.addLiquidity}
                                        refreshBalance={this.controller.refreshBalance}
                                    />
                                ) : null}
                                {this.state.mode === "removeLiquidity" ? (
                                    <RemoveLiquidityCard 
                                        token={referenceToken} 
                                        amountToBeRemoved = {this.state.amountToBeRemoved}
                                        onRemoveLiquidity = {this.removeLiquidity}
                                        percent = {this.state.removePercent}
                                    />
                                ) : null}
                            </div> : null}
                            {this.state.isOwner ? <ReferralsCard key={this.state.walletAddress} onManage={this.controller.manageReferrals} /> : null}
                        </>) : null}
                        <PositionStatusSynopsis
                            token={referenceToken}
                            isOwner={this.state.isOwner}
                            items={this.state.positions}
                            rebalance={this.state.rebalance}
                            onRebalance={this.controller.rebalance}
                            synopticConverted={this.state.synopticConverted}
                            toggleSynopticConverted={() => this.toggleLocalStorageVar("synopticConverted")}
                        />
                        <div className = "footer-note">{"\u00a0"}</div>
                    </>}
                </div>
                {this.state.tokenPickerOpen ? (
                    <TokenPickerModal
                        selectedAddress = {this.state[(this.state.tokenPickerContext === 'addLiquidity' ? 'addLiquidity' : 'reference') + "TokenAddress"]}
                        onClose = {this.closeTokenPicker}
                        onSelect = {this.handleTokenSelected}
                        onTokensChanged = {this.handleCustomTokensChanged}
                    />
                ) : null}
            </div>
        );
    }
});
