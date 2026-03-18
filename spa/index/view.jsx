function readStoredSection() {
    try { return localStorage.getItem("dabottoSection") || "overview"; } catch(e) { return "overview"; }
}

var Index = React.createClass({
    requiredScripts: [
        "spa/components/Disclaimer.jsx",
        "spa/components/HowItWorks.jsx",
        "spa/components/ScrollTopButton.jsx",
        "spa/components/RpcSettings.jsx",
        "spa/components/ImpersonationCard.jsx",
        "spa/components/WalletCard.jsx",
        "spa/components/ClaimRewardCard.jsx",
        "spa/components/ModeSelector.jsx",
        "spa/components/AddLiquidityCard.jsx",
        "spa/components/ReferralsCard.jsx",
        "spa/components/RemoveLiquidityCard.jsx",
        "spa/components/TokenPickerModal.jsx",
        "spa/components/PositionStatusSynopsis.jsx",
        "spa/components/ConsoleCard.jsx",
        "spa/components/HarvestCycle.jsx",
        "spa/components/CapitalCard.jsx"
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
            hasFarmingBalance: null,
            walletReadError: false,
            walletLanding: false,
            connectedIsOwner: false,
            connectedIsReferral: false,
            mode: "addLiquidity",
            referenceTokenAddress: readNetworkPreference("referenceTokenAddress") || getAppNetwork().referenceTokenAddress,
            addLiquidityTokenAddress: readNetworkPreference("addLiquidityTokenAddress") || voidEthereumAddress,
            tokenPickerOpen: false,
            tokenPickerContext: "claimReward",
            tokenCacheVersion: 0,
            toast: "",
            balance : null,
            balanceInReference : null,
            removePercent : "0",
            withdrawalQuote : null,
            synopticConverted : localStorage.synopticConverted === 'true',
            net : localStorage.net === 'true',
            section : readStoredSection(),
            selectedPool : null,
            sheetOpen : false,
            walletBalanceView : null
        };
    },
    setLocalStorageValue(name, value) {
        var self = this;
        localStorage.setItem(name, value);
        this.setState({[name] : value}, () => self.controller.init());
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
            this.controller.toRebalance = [];
            return this.setState({ walletAddress: '', hasFarmingBalance: null, walletReadError: false, walletLanding: false, connectedIsOwner: false, connectedIsReferral: false, balance: null, allowance: null, balanceInReference: null, positions: [], summary: null, claimableValue: null, rebalance: false, isOwner: false, withdrawalQuote: null, tokenPickerOpen: false, toast: '' });
        }
        var session = requireWalletSession();
        self.controller.refreshReferral();
        walletAddress = sessionStorage.getItem('dabotto:impersonate') || walletAddress;
        self.setState({ walletAddress, hasFarmingBalance: null, walletReadError: false, walletLanding: true, mode: "addLiquidity", balance: null, allowance: null, balanceInReference: null, summary: null, claimableValue: null, withdrawalQuote: null }, function() {
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
        var referenceChanged = key === 'referenceTokenAddress';
        if(address !== this.state[key]) {
            next.balanceInReference = null;
            if(referenceChanged) {
                next.withdrawalQuote = null;
            } else {
                next.balance = next.allowance = null;
            }
        }
        this.setState(next, () => {
            this.controller.refreshBalance();
            if(referenceChanged) this.controller.init();
        });
    },
    handleCustomTokensChanged: function() {
        this.bumpTokenCache();
    },
    approveToken(address, value) {
        var self = this;
        address = web3util.utils.toChecksumAddress(address);
        var toast;
        var session = requireWalletSession();
        this.controller.approveForAddLiquidity(address, value)
        .then(() => {
            toast = "Approval ready. You can add liquidity now.";
        })
        .catch(e => toast = e.message)
        .finally(() => {        
            if(!session.active) return;
            self.setState({ toast });
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
        this.controller.addLiquidity(address, value, subject)
        .then(() => {
            toast = "The beneficiary's farming position has been increased.";
        })
        .catch(e => toast = e.message)
        .finally(() => {        
            if(!session.active) return;
            self.setState({ toast });
            setTimeout(function() {
                self.setState({ toast: "" });
            }, 2200);
        });
    },
    removeLiquidity : function(address, removePercent, readonly) {
        var self = this;
        var session = window.walletSession;
        if(!session || !session.active) return;
        var value = web3utils.toBN(toDecimals(removePercent, 18)).divn(100).toString();
        if (!readonly) {
            return this.controller.removeLiquidity(address, value, false).catch(error => {
                if (session.active && window.walletSession === session) self.setState({toast: error.message});
            });
        }
        clearTimeout(this.removeLiquidityTimeout);
        var version = this.withdrawalQuoteVersion = (this.withdrawalQuoteVersion || 0) + 1;
        var walletAddress = this.state.walletAddress;
        var current = () => session.active && window.walletSession === session && version === self.withdrawalQuoteVersion
            && walletAddress === self.state.walletAddress
            && String(address).toLowerCase() === String(self.state.referenceTokenAddress).toLowerCase();
        this.setState({withdrawalQuote: null, removePercent});
        if (parseFloat(removePercent) <= 0) return;
        this.removeLiquidityTimeout = setTimeout(() => {
            if (!current()) return;
            self.controller.removeLiquidity(address, value, true).then(result => {
                if (current()) self.setState({
                    withdrawalQuote: {capital: result.removedAmount, reward: result.claimedReward}
                });
            }).catch(error => {
                if (current()) self.setState({toast: error.message});
            });
        }, 700);
    },
    setMode: function(mode) {
        this.setState({ mode: mode, balance: null, allowance: null, balanceInReference: null }, this.controller.refreshBalance);
    },
    updateFarmingBalance: function(hasFarmingBalance) {
        this.setState(function(state) {
            if(state.hasFarmingBalance === hasFarmingBalance) return null;
            var next = { hasFarmingBalance, walletLanding: false };
            if(!hasFarmingBalance) {
                next.mode = "addLiquidity";
                if(state.walletLanding || state.section === "overview") {
                    next.section = "liquidity";
                    next.sheetOpen = false;
                }
            }
            return next;
        });
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
            if(summary) self.removeLiquidity(self.state.referenceTokenAddress, self.state.removePercent, true);
        });
    },
    toggleDisclaimer() {
        var self = this;
        this.setState({showDisclaimer : !this.state.showDisclaimer}, () => {
            window.sessionStorage.setItem('disclaimerAccepted', 'true');
            self.state.showDisclaimer && window.scrollTo(0, 0);
        });
    },
    toggleHowItWorks() {
        var self = this;
        this.setState({showHowItWorks : !this.state.showHowItWorks}, () => (self.state.showHowItWorks || self.state.showDisclaimer) && window.scrollTo(0, 0));
    },
    renderTopbarInfo() {
        return <div className = "shell-topbar-info">
            <button type = "button" className = "shell-icon-button" aria-label = "How it works" title = "How it works" onClick = {this.toggleHowItWorks}>
                <i className = "fa-solid fa-circle-info" aria-hidden = "true"></i>
            </button>
            <button type = "button" className = "shell-icon-button" aria-label = "Disclaimer" title = "Disclaimer" onClick = {this.toggleDisclaimer}>
                <i className = "fa-solid fa-scale-balanced" aria-hidden = "true"></i>
            </button>
        </div>;
    },
    setSection(section) {
        if(section === "overview" && this.state.hasFarmingBalance !== true) return;
        this.setState({ section: section, sheetOpen: false, walletLanding: false });
        try { localStorage.setItem("dabottoSection", section); } catch(e) {}
        window.scrollTo && window.scrollTo(0, 0);
    },
    selectPool(key, openSheet) {
        this.setState({ selectedPool: key, sheetOpen: openSheet !== false });
    },
    openPool(key) {
        this.setSection("positions");
        this.setState({ selectedPool: key, sheetOpen: true });
    },
    getSections() {
        var positions = this.state.positions || [];
        var attention = positions.filter(item => Math.abs(item.statusResult) === 2).length;
        var sections = [
            { id: "overview", label: "Overview", icon: "fa-solid fa-gauge-high" },
            { id: "liquidity", label: "Liquidity", icon: "fa-solid fa-droplet" },
            { id: "positions", label: "Positions", icon: "fa-solid fa-layer-group", badge: attention || null }
        ];
        this.state.isOwner && sections.push({ id: "referrals", label: "Referrals", icon: "fa-solid fa-user-group" });
        sections.push({ id: "account", label: "Account", icon: "fa-solid fa-wallet" });
        return sections;
    },
    renderNavItem(section, className) {
        var connected = !!this.state.walletAddress;
        var current = this.getCurrentSection() === section.id;
        var disabled = !connected && section.id !== "account" || section.id === "overview" && this.state.hasFarmingBalance !== true;
        return <button
            key = {section.id}
            type = "button"
            className = {className + (current ? " is-current" : "")}
            aria-current = {current ? "page" : undefined}
            disabled = {disabled}
            onClick = {() => this.setSection(section.id)}
        >
            <i className = {section.icon} aria-hidden = "true"></i>
            <span className = "shell-nav-label">{section.label}</span>
            {section.badge ? <span className = "shell-nav-badge" aria-label = {section.badge + " unbalanced"}>{section.badge}</span> : null}
        </button>;
    },
    getCurrentSection() {
        if(!this.state.walletAddress) return "account";
        if(this.state.walletLanding) return "liquidity";
        var ids = this.getSections().map(section => section.id);
        var section = ids.indexOf(this.state.section) === -1 ? "overview" : this.state.section;
        return section === "overview" && this.state.hasFarmingBalance !== true ? "liquidity" : section;
    },
    renderBrand() {
        return <div className = "brand">
            <div className = "brand-mark" aria-hidden = "true">
                <i className = "fa-solid fa-water"></i>
            </div>
            <div className = "brand-text">
                <div className = "app-title">dabotto</div>
                <div className = "eyebrow">{getAppNetwork().name} · liquidity farming</div>
            </div>
        </div>;
    },
    renderWalletChip() {
        var session = window.walletSession;
        var address = this.state.walletAddress && session && session.active ? session.address : "";
        if(!address) {
            return <button type = "button" className = "shell-wallet-chip" onClick = {() => this.setSection("account")}>
                <span className = "shell-wallet-dot" aria-hidden = "true"></span>
                <span>Connect wallet</span>
            </button>;
        }
        return <div className = "shell-wallet-chip is-connected">
            <button type = "button" className = "shell-wallet-open" onClick = {() => this.setSection("account")} aria-label = "Open account" title = "Open account">
                <span className = "shell-wallet-dot is-on" aria-hidden = "true"></span>
            </button>
            <a className = "shell-wallet-address" href = {getEtherscanAddress("address/" + address, session.chainId)} target = "_blank" rel = "noopener noreferrer" title = {address} aria-label = {"View " + address + " on the block explorer (opens in a new tab)"}>
                <span>{shortAddress(address)}</span>
                <i className = "fa-solid fa-arrow-up-right-from-square" aria-hidden = "true"></i>
            </a>
        </div>;
    },
    renderWalletSummary(referenceToken) {
        var session = window.walletSession;
        var connected = this.state.walletAddress && session && session.active;
        var tokenAddress = referenceToken ? referenceToken.address : "";
        var view = this.state.walletBalanceView;
        var current = view && view.address === (connected ? session.address : "") && view.tokenAddress === tokenAddress;
        var overview = this.getCurrentSection() === "overview";
        return <div className = "shell-wallet-summary" aria-label = "Wallet summary" role = "group">
            <div className = "shell-wallet-reference">
                {this.renderReferenceToken(referenceToken)}
            </div>
            {connected ? <div className = "shell-wallet-balances" role = "status">
                {current && view.assets.length ? view.assets.filter(asset => !overview || asset.key !== "reference" || asset.hasBalance).map(asset =>
                    <div className = "shell-wallet-balance" key = {asset.key} title = {asset.title}>
                        <span>{asset.symbol} balance</span>
                        <strong>{asset.amount}{asset.unit ? " " + asset.unit : ""}</strong>
                    </div>
                ) : <span>{current ? view.status : "Loading balance" + String.fromCharCode(0x2026)}</span>}
            </div> : null}
            {this.renderWalletChip()}
        </div>;
    },
    renderInfoLinks() {
        return <div className = "shell-info-links">
            <button type = "button" className = "shell-link" onClick = {this.toggleHowItWorks}>
                <i className = "fa-solid fa-circle-info" aria-hidden = "true"></i>How it works
            </button>
            <button type = "button" className = "shell-link" onClick = {this.toggleDisclaimer}>
                <i className = "fa-solid fa-scale-balanced" aria-hidden = "true"></i>Disclaimer
            </button>
        </div>;
    },
    renderPageHead(title, copy, actions) {
        return <div className = "page-head">
            <div>
                <h1 className = "page-title">{title}</h1>
                {copy ? <div className = "page-copy">{copy}</div> : null}
            </div>
            {actions ? <div className = "page-actions">{actions}</div> : null}
        </div>;
    },
    renderOverview(referenceToken) {
        return <ClaimRewardCard
            token = {referenceToken}
            claimableValue = {this.state.claimableValue}
            summary = {this.state.summary}
            positions = {this.state.positions}
            onClaimReward = {this.controller.claimReward}
            loadHarvestPolicy = {this.controller.readHarvestPolicy}
            onOpenPool = {this.openPool}
            onShowPositions = {() => this.setSection("positions")}
            setForecastRate = {(name, value) => this.setLocalStorageValue(name, value)}
            net = {this.state.net}
            toggleNet = {() => this.toggleLocalStorageVar("net")}
            isOwner = {this.state.isOwner}
        />;
    },
    renderReferenceToken(referenceToken) {
        var symbol = referenceToken ? referenceToken.symbol : "Select";
        return <button type = "button" className = "shell-reference-token" onClick = {() => this.openTokenPicker("claimReward")} aria-label = {"Change reference token, " + symbol} aria-haspopup = "dialog">
            <span className = "shell-reference-label">Reference token</span>
            <strong>{symbol}</strong>
            <i className = "fa-solid fa-chevron-down" aria-hidden = "true"></i>
        </button>;
    },
    renderLiquidity(referenceToken, addToken) {
        return <>
            {this.renderPageHead("Liquidity", this.state?.summary?.hasParticipation ? "Add more liquidity through your favorite token or decrease your participation." : "Start collecting rewards by adding liquidity.")}
            <div className = "page-grid">
                {referenceToken ? <div className = "glass-card card-pad">
                    <ModeSelector mode = {this.state.mode} onChange = {this.setMode} removeDisabled = {this.state?.summary?.hasHeritage === false}/>
                    {this.state.mode === "addLiquidity" ? (
                        <AddLiquidityCard
                            key = {this.state.walletAddress}
                            isOwner = {this.state.isOwner}
                            walletAddress = {this.state.walletAddress}
                            token = {addToken}
                            referenceToken = {referenceToken}
                            estimateRewards = {this.controller.estimateLiquidityRewards}
                            balance = {this.state.balance}
                            balanceInReference = {this.state.balanceInReference}
                            allowance = {this.state.allowance}
                            onOpenPicker = {this.openTokenPicker.bind(this)}
                            onApprove = {this.approveToken}
                            toast = {this.state.toast}
                            onAddLiquidity = {this.addLiquidity}
                            refreshBalance = {this.controller.refreshBalance}
                        />
                    ) : null}
                    {this.state.mode === "removeLiquidity" ? (
                        <RemoveLiquidityCard
                            token = {referenceToken}
                            withdrawalQuote = {this.state.withdrawalQuote}
                            onRemoveLiquidity = {this.removeLiquidity}
                            percent = {this.state.removePercent}
                        />
                    ) : null}
                </div> : <div className = "glass-card card-pad"><div className = "card-copy">Select a reference token first.</div></div>}
            </div>
        </>;
    },
    renderPositions(referenceToken) {
        return <PositionStatusSynopsis
            token = {referenceToken}
            referenceTokenAddress = {this.state.referenceTokenAddress}
            isOwner = {this.state.isOwner}
            items = {this.state.positions}
            rebalance = {this.state.rebalance}
            onRebalance = {this.controller.rebalance}
            synopticConverted = {this.state.synopticConverted}
            toggleSynopticConverted = {() => this.toggleLocalStorageVar("synopticConverted")}
            selectedKey = {this.state.selectedPool}
            sheetOpen = {this.state.sheetOpen}
            onSelect = {this.selectPool}
            onCloseSheet = {() => this.setState({ sheetOpen: false })}
        />;
    },
    renderAccount(referenceToken) {
        var connected = !!this.state.walletAddress;
        return <>
            {connected ? this.renderPageHead("Account", "Wallet, network and connection settings.") : <div className = "welcome">
                <div className = "welcome-mark" aria-hidden = "true"><i className = "fa-solid fa-water"></i></div>
                <h1 className = "welcome-title">Liquidity farming, without the busywork</h1>
                <p className = "welcome-copy">Connect your wallet to see your rewards, manage your liquidity and follow every position.</p>
            </div>}
            <div className = {"page-grid" + (connected ? " page-grid-split" : " page-grid-narrow")}>
                <WalletCard
                    walletAddress = {this.state.walletAddress && window.walletSession ? window.walletSession.address : ''}
                    isReferral = {this.state.connectedIsReferral}
                    referenceToken = {referenceToken}
                    getManager = {this.controller.getManager}
                    onWallet = {this.onWallet.bind(this)}
                    onBalanceView = {view => this.setState({ walletBalanceView: view })}
                />
                {connected && this.state.connectedIsOwner ? <ImpersonationCard /> : null}
            </div>
            {!connected ? this.renderInfoLinks() : null}
        </>;
    },
    renderSection(referenceToken, addToken) {
        switch(this.getCurrentSection()) {
            case "overview": return this.renderOverview(referenceToken);
            case "liquidity": return this.renderLiquidity(referenceToken, addToken);
            case "positions": return this.renderPositions(referenceToken);
            case "referrals": return <>
                {this.renderPageHead("Referrals", "Choose which wallets can deposit on behalf of other wallets on " + getAppNetwork().name + ".")}
                <ReferralsCard key = {this.state.walletAddress} onManage = {this.controller.manageReferrals} onCheck = {this.controller.checkReferral} networkName = {getAppNetwork().name} />
            </>;
            default: return null;
        }
    },
    render: function() {

        var referenceToken = getTokenMetaByAddress(this.state.referenceTokenAddress);
        var addToken = getTokenMetaByAddress(this.state.addLiquidityTokenAddress);

        var info = this.state.showHowItWorks || this.state.showDisclaimer;
        var sections = this.getSections();

        return (
            <div className = {info ? "dashboard-shell dashboard-shell-info" : "shell"}>
                {info ? <div className = "app-stack">
                    {this.state.showHowItWorks ? <HowItWorks onDismiss = {this.toggleHowItWorks}/> : <Disclaimer expanded = {sessionStorage.disclaimerAccepted === "true"} onDismiss = {this.toggleDisclaimer} onHowItWorks = {this.toggleHowItWorks}/>}
                    <ScrollTopButton/>
                </div> : <>
                    <aside className = "shell-sidebar">
                        {this.renderBrand()}
                        <nav className = "shell-nav" aria-label = "Sections">
                            {sections.map(section => this.renderNavItem(section, "shell-nav-item"))}
                        </nav>
                        <div className = "shell-sidebar-foot">
                            {this.renderInfoLinks()}
                            <div className = "shell-network">
                                <span className = "shell-network-label">Network</span>
                                <span className = "shell-network-name">{getAppNetwork().name}</span>
                            </div>
                        </div>
                    </aside>
                    <div className = "shell-body">
                        <header className = "shell-topbar">
                            {this.renderBrand()}
                            {this.renderTopbarInfo()}
                            {this.renderWalletSummary(referenceToken)}
                        </header>
                        <main className = {"shell-main shell-main-" + this.getCurrentSection()}>
                            {this.state.walletReadError ? <div className = "page-copy" role = "status">Wallet position and rewards are temporarily unavailable for {referenceToken?.symbol || "the selected token"}.</div> : null}
                            {this.getCurrentSection() !== "account" ? this.renderSection(referenceToken, addToken) : null}
                            <div className = "shell-account" hidden = {this.getCurrentSection() !== "account"}>
                                {this.renderAccount(referenceToken)}
                            </div>
                        </main>
                    </div>
                    <nav className = "shell-tabbar" aria-label = "Sections">
                        {sections.map(section => this.renderNavItem(section, "shell-tab"))}
                    </nav>
                    <div className = "shell-console"><ConsoleCard/></div>
                </>}
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
