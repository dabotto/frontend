var Index = React.createClass({
    requiredScripts: [
        "spa/components/Disclaimer.jsx",
        "spa/components/HowItWorks.jsx",
        "spa/components/WalletCard.jsx",
        "spa/components/ClaimRewardCard.jsx",
        "spa/components/ModeSelector.jsx",
        "spa/components/AddLiquidityCard.jsx",
        "spa/components/RemoveLiquidityCard.jsx",
        "spa/components/TokenPickerModal.jsx",
        "spa/components/PositionStatusSynopsis.jsx"
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
            referenceTokenAddress: localStorage.referenceTokenAddress || "",
            addLiquidityTokenAddress: localStorage.addLiquidityTokenAddress || "",
            approvedTokens: {
            },
            tokenPickerOpen: false,
            tokenPickerContext: "claimReward",
            tokenCacheVersion: 0,
            toast: "",
            balance : null,
            removePercent : "0",
            synopticConverted : localStorage.synopticConverted === 'true'
        };
    },
    toggleSynopticConverted() {
        var self = this;
        this.setState({synopticConverted : !this.state.synopticConverted}, () => {
            localStorage.setItem("synopticConverted", self.state.synopticConverted ? 'true' : false);
            self.controller.init();
        });
    },
    bumpTokenCache: function() {
        this.setState({ tokenCacheVersion: Date.now() });
    },
    onWallet: function(walletAddress) {
        var self = this;
        self.setState({
            walletAddress
        }, walletAddress && ensureDefaultTokenCache(function() {
            self.bumpTokenCache();
            self.controller.refreshBalance();
            self.controller.init();
        }));
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
        localStorage.setItem(key, next[key] = address);
        this.setState(next, this.state.tokenPickerContext !== 'addLiquidity' ? this.controller.init : this.controller.refreshBalance);
    },
    handleCustomTokensChanged: function() {
        this.bumpTokenCache();
    },
    approveToken(address, value) {
        var self = this;
        address = web3util.utils.toChecksumAddress(address);
        var toast;
        var next = Object.assign({}, this.state.approvedTokens);
        this.controller.approveForAddLiquidity(address, value)
        .then(() => {
            toast = "Approval ready. You can add liquidity now.";
            next[address] = true;
        })
        .catch(e => toast = e.message)
        .finally(() => {        
            self.setState({ approvedTokens: next, toast });
            setTimeout(function() {
                self.setState({ toast: "" });
            }, 2200);
        });
    },
    addLiquidity(address, value) {
        var self = this;
        address = web3util.utils.toChecksumAddress(address);
        var toast;
        var next = Object.assign({}, this.state.approvedTokens);
        this.controller.addLiquidity(address, value)
        .then(() => {
            toast = "Your farming position has been increased.";
            next[address] = false;
        })
        .catch(e => toast = e.message)
        .finally(() => {        
            self.setState({ approvedTokens: next, toast });
            setTimeout(function() {
                self.setState({ toast: "" });
            }, 2200);
        });
    },
    removeLiquidity : function(address, removePercent, readonly) {
        var self = this;
        this.setState({amountToBeRemoved : readonly ? null : this.state.amountToBeRemoved, removePercent}, function() {
            self.removeLiquidityTimeout && clearTimeout(self.removeLiquidityTimeout);
            parseFloat(removePercent) != 0 && (self.removeLiquidityTimeout = setTimeout(() => self.controller.removeLiquidity(address, toDecimals(removePercent, 16), readonly).then(result => {
                readonly && this.setState({amountToBeRemoved : result.removedAmount});
            }), readonly ? 700 : 0));
        });
    },
    setMode: function(mode) {
        this.setState({ mode: mode, balance : null }, this.controller.refreshBalance);
    },
    initRefresh(result) {
        if(!result) {
            return;
        }
        var [positions, rebalance, isOwner, claimableValue, summary] = result;
        var next = {
            isOwner,
            positions : positions && positions.length !== 0 ? positions : this.state.positions,
            rebalance : rebalance || this.state.rebalance
        };
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
                        <WalletCard
                            walletAddress = {this.state.walletAddress}
                            onWallet = {this.onWallet}
                        />
                        {this.state.walletAddress ? (<>
                            <ClaimRewardCard
                                token = {referenceToken}
                                claimableValue = {this.state.claimableValue}
                                summary = {this.state.summary}
                                onOpenPicker = {this.openTokenPicker}
                                onClaimReward = {this.controller.claimReward}
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
                                        token = {addToken}
                                        balance = {this.state.balance}
                                        allowance = {this.state.allowance}
                                        approvedTokens = {this.state.approvedTokens}
                                        onOpenPicker = {this.openTokenPicker}
                                        onApprove = {this.approveToken}
                                        toast = {this.state.toast}
                                        onAddLiquidity = {this.addLiquidity}
                                        refreshBalance={this.props.refreshBalance}
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
                        </>) : null}
                        <PositionStatusSynopsis
                            token={referenceToken}
                            isOwner={this.state.isOwner}
                            items={this.state.positions}
                            rebalance={this.state.rebalance}
                            onRebalance={this.controller.rebalance}
                            synopticConverted={this.state.synopticConverted}
                            toggleSynopticConverted={this.toggleSynopticConverted}
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