var WalletCard = React.createClass({
    getInitialState: function() { return { switching: false, error: '', walletBalance: null, balanceUnavailable: false }; },
    balanceTokenKey: function(props) {
        var token = props.referenceToken;
        return token ? [token.address.toLowerCase(), token.decimals, token.symbol].join(':') : '';
    },
    componentDidUpdate: function(previous) {
        if(!previous || previous.walletAddress !== this.props.walletAddress || previous.manager !== this.props.manager || this.balanceTokenKey(previous) !== this.balanceTokenKey(this.props)) {
            this.refreshWalletBalance();
        }
    },
    refreshWalletBalance: async function() {
        var session = window.walletSession;
        var address = this.props.walletAddress;
        if(this.disposed || !session || !session.active || session.chainId !== window.chainId || !address || session.address.toLowerCase() !== address.toLowerCase()) return;
        var manager = this.props.manager;
        var token = this.props.referenceToken;
        var tokenKey = this.balanceTokenKey(this.props);
        var pending = this.balanceRequest;
        if(pending && pending.session === session && pending.tokenKey === tokenKey && pending.manager === manager) return;
        var request = this.balanceRequest = { session, tokenKey, manager };
        var current = () => !this.disposed && this.balanceRequest === request && session.active && window.walletSession === session &&
            session.chainId === window.chainId && this.props.walletAddress === address && this.props.manager === manager && this.balanceTokenKey(this.props) === tokenKey;
        try {
            var native = String(await web3.eth.getBalance(address));
            if(!current()) return;
            var balance = { address, chainId: session.chainId, session, native, tokenKey, manager, reference: null };
            var previous = this.state.walletBalance;
            if(previous && previous.session === session && previous.native === native && previous.tokenKey === tokenKey && previous.manager === manager) balance.reference = previous.reference;
            this.setState({ walletBalance: balance, balanceUnavailable: false });
            var registry = getAppNetwork().tokenRegistry;
            var wrapped = Object.keys(registry).find(key => registry[key].symbol.toUpperCase() === 'WETH');
            if(!manager || !token || token.address.toLowerCase() === voidEthereumAddress.toLowerCase() || (wrapped && token.address.toLowerCase() === wrapped.toLowerCase()) || /^(ETH|WETH)$/i.test(token.symbol)) return;
            try {
                var reference = native === '0' ? '0' : String(await manager.methods.convert(voidEthereumAddress, voidEthereumAddress, native, token.address).call());
                if(current()) this.setState({ walletBalance: Object.assign({}, balance, { reference }) });
            } catch(e) {
                if(current()) this.setState({ walletBalance: Object.assign({}, balance, { reference: null }) });
            }
        } catch(e) {
            if(current()) this.setState({ walletBalance: null, balanceUnavailable: true });
        } finally {
            if(this.balanceRequest === request) this.balanceRequest = null;
        }
    },
    formatWalletBalance: function(value, decimals) {
        var amount = fromDecimals(value, decimals, true);
        var digits = Number(decimals) === 18 ? 6 : Math.min(Number(decimals), 2);
        if(Number(amount) > 0 && Number(amount) < Math.pow(10, -digits)) return '<' + Math.pow(10, -digits).toFixed(digits);
        return formatMoney(amount, digits);
    },
    renderWalletBalance: function() {
        var balance = this.state.walletBalance;
        if(!balance || balance.address !== this.props.walletAddress || balance.chainId !== window.chainId || balance.session !== window.walletSession || !balance.session.active) {
            return <span className="wallet-balance wallet-balance-muted" role="status">{this.state.balanceUnavailable ? 'Balance unavailable' : 'Loading balance' + String.fromCharCode(0x2026)}</span>;
        }
        var native = this.formatWalletBalance(balance.native, 18) + ' ETH';
        var converted = this.props.manager && this.props.referenceToken && balance.reference !== null && balance.tokenKey === this.balanceTokenKey(this.props) && balance.manager === this.props.manager;
        return <span className="wallet-balance" role="status" title="Native ETH balance of the connected wallet; reference value is an estimate.">
            <span className="wallet-balance-primary">{converted ? String.fromCharCode(0x2248) + ' ' + this.formatWalletBalance(balance.reference, this.props.referenceToken.decimals) + ' ' + this.props.referenceToken.symbol : native}</span>
            {converted ? <span className="wallet-balance-secondary">{native}</span> : null}
        </span>;
    },
    componentDidMount: function() {
        var self = this;
        var networks = getAppKitNetworks();
        var options = {
            networks,
            projectId: '1f64e5892f6e4e11a9b7444ddfa0d0ae',
            defaultNetwork: networks.find(it => it.id === window.chainId)
        };
        if(!window.walletModal) {
            var transports = Object.fromEntries(networks.map(it => [it.id, walletTransport(it.id)]));
            var adapter = new window.appKit.WagmiAdapter({ ...options, transports });
            Object.assign(adapter.wagmiConfig._internal.transports, transports);
            window.walletModal = window.appKit.createAppKit({
                ...options,
                features: { analytics: false, swaps: false, onramp: false },
                adapters: [adapter]
            });
        }
        this.modalWasOpen = walletModal.isOpen();
        this.unsubscribers = ['subscribeAccount', 'subscribeNetwork', 'subscribeProviders'].filter(name => typeof walletModal[name] === 'function').map(name => walletModal[name](function() {
            self.syncWallet();
            if(name === 'subscribeAccount') self.ensureWalletOpen();
        }));
        this.unsubscribers.push(walletModal.subscribeState(function(state) {
            self.syncWallet();
            var wasOpen = self.modalWasOpen;
            self.modalWasOpen = state.open;
            if(wasOpen && !state.open) {
                clearTimeout(self.walletReopenTimeout);
                self.walletReopenTimeout = setTimeout(() => self.ensureWalletOpen(), 0);
            }
        }));
        this.syncWallet();
        this.ensureWalletOpen();
        this.balanceRefreshTimer = setInterval(this.refreshWalletBalance, 15000);
        this.refreshWalletBalance();
    },
    ensureWalletOpen: async function() {
        if(this.disposed) return;
        var modal = window.walletModal;
        try {
            await modal.ready();
            if(this.disposed || modal.getAddress() || modal.isOpen()) return;
            var account = modal.getAccount();
            if(account && (account.isConnected || account.status === 'connecting' || account.status === 'reconnecting')) return;
            await this.openWallet();
        } catch(e) {
            if(!this.disposed) this.setState({ error: e.message || String(e) });
        }
    },
    openWallet: async function() {
        if(this.disposed || this.openingWallet) return;
        this.openingWallet = true;
        try {
            await window.walletModal.open({ view: 'Connect' });
        } catch(e) {
            if(!this.disposed) this.setState({ error: e.message || String(e) });
        } finally {
            this.openingWallet = false;
        }
    },
    componentWillUnmount: function() {
        this.disposed = true;
        clearInterval(this.balanceRefreshTimer);
        clearTimeout(this.walletReopenTimeout);
        (this.unsubscribers || []).forEach(unsubscribe => typeof unsubscribe === 'function' && unsubscribe());
        this.detachProvider();
        invalidateWalletSession();
    },
    detachProvider: function() {
        var provider = this.provider;
        if(provider && provider.removeListener) {
            Object.entries(this.providerListeners || {}).forEach(([name, handler]) => provider.removeListener(name, handler));
        }
        this.provider = null;
    },
    attachProvider: function(provider) {
        if(this.provider === provider) return;
        this.detachProvider();
        this.provider = provider;
        this.providerListeners = {
            chainChanged: chainId => {
                this.syncVersion = (this.syncVersion || 0) + 1;
                invalidateWalletSession();
                this.props.onWallet('');
                if(Number(chainId) === window.chainId) return this.syncWallet();
                if(getAppNetwork(chainId)) return reloadAppNetwork(chainId);
                this.setState({ switching: false, error: 'Unsupported network. Select Base or Robinhood Chain.' });
            },
            accountsChanged: accounts => {
                if(window.walletSession && (accounts[0] || '').toLowerCase() === window.walletSession.address.toLowerCase()) return;
                this.syncVersion = (this.syncVersion || 0) + 1;
                invalidateWalletSession();
                this.props.onWallet('');
                reloadAppNetwork(window.chainId);
            },
            disconnect: () => {
                this.syncVersion = (this.syncVersion || 0) + 1;
                invalidateWalletSession();
                this.props.onWallet('');
            }
        };
        Object.entries(this.providerListeners).forEach(([name, handler]) => provider.on && provider.on(name, handler));
    },
    syncWallet: async function() {
        if(this.disposed || this.state.switching) return;
        var modal = window.walletModal;
        var provider = modal.getWalletProvider();
        var address = modal.getAddress();
        var known = window.walletSession;
        if(known && known.active && known.provider === provider && known.address.toLowerCase() === (address || '').toLowerCase() && Number(modal.getChainId()) === known.chainId) return;
        var version = this.syncVersion = (this.syncVersion || 0) + 1;
        invalidateWalletSession();
        this.props.onWallet('');
        if(!provider || !address) { this.detachProvider(); return; }
        this.attachProvider(provider);
        try {
            var chainId = Number(await provider.request({ method: 'eth_chainId' }));
            var accounts = await provider.request({ method: 'eth_accounts' });
            if(this.disposed || version !== this.syncVersion) return;
            if((accounts[0] || '').toLowerCase() !== address.toLowerCase()) return;
            if(!getAppNetwork(chainId)) return this.setState({ error: 'Unsupported network. Select Base or Robinhood Chain.' });
            if(chainId !== window.chainId || (known && known.address.toLowerCase() !== address.toLowerCase())) return reloadAppNetwork(chainId);
            createWalletSession(provider, chainId, address);
            this.setState({ error: '' });
            this.props.onWallet(address);
        } catch(e) {
            if(!this.disposed && version === this.syncVersion) this.setState({ error: e.message || String(e) });
        }
    },
    switchNetwork: async function(chainId) {
        if(this.state.switching) return;
        var provider = window.walletModal.getWalletProvider();
        if(!provider) return reloadAppNetwork(chainId);
        this.syncVersion = (this.syncVersion || 0) + 1;
        invalidateWalletSession();
        this.props.onWallet('');
        this.setState({ switching: true, error: '' });
        try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + Number(chainId).toString(16) }] });
            var actual = Number(await provider.request({ method: 'eth_chainId' }));
            if(actual !== Number(chainId)) throw new Error('The wallet has not switched to the requested network.');
            reloadAppNetwork(actual);
        } catch(e) {
            if(this.disposed) return;
            var error = Number(e.code || (e.data && e.data.originalError && e.data.originalError.code)) === 4902 ? 'Add this network in your wallet, then try again. No alternative RPC is configured by this app.' : (e.message || String(e));
            this.setState({ switching: false }, async () => { await this.syncWallet(); if(!this.disposed) this.setState({ error }); });
        }
    },
    renderConnected: function() {
        return (
            <div className = "wallet-panel">
                <div className = "wallet-panel-head">
                    <span className = "wallet-status"><span className = "wallet-status-dot" aria-hidden="true"></span>Connected</span>
                    {this.props.isReferral ? <span className="wallet-referral-badge" title="This connected wallet is authorized to deposit for other wallets on the selected network."><i className="fa-solid fa-user-check" aria-hidden="true"></i>Referral</span> : null}
                </div>
                <div className = "wallet-identity">
                    <span className = "token-avatar" aria-hidden="true"><i className = "fa-solid fa-wallet"></i></span>
                    <a className = "wallet-address-link" href = {getEtherscanAddress("address/" + this.props.walletAddress)} target="_blank" title = {this.props.walletAddress}>{shortAddress(this.props.walletAddress)}<i className = "fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                    <button type="button" className = "small-chip wallet-manage-button" aria-label="Manage wallet" onClick={() => window.walletModal.open({view:"Account"})}><i className = "fa-solid fa-gear" aria-hidden="true"></i><span className = "wallet-manage-label">Manage</span></button>
                </div>
                <div className = "wallet-balance-block">
                    <div className = "field-label">Balance</div>
                    {this.renderWalletBalance()}
                </div>
            </div>
        );
    },
    render: function() {
        return (
            <div className = "glass-card card-pad">
                <div className = "card-header">
                    <div>
                        <h2 className = "card-title">Wallet</h2>
                        <div className = "card-copy">Connect your wallet to unlock rewards and liquidity actions.</div>
                    </div>
                </div>
                <div className="network-selector" role="group" aria-label="Network">
                    {Object.values(window.context.networks).map(network => <button key={network.id} type="button" className={'button-base ' + (network.id === window.chainId ? 'button-primary' : 'button-secondary')} aria-pressed={network.id === window.chainId} disabled={this.state.switching} onClick={() => this.switchNetwork(network.id)}>{network.name}</button>)}
                </div>
                {this.state.switching ? <div className="helper-text" role="status">{'Confirm the network switch in your wallet' + String.fromCharCode(0x2026)}</div> : null}
                {this.state.error ? <div className="notice-box" role="alert">{this.state.error}</div> : null}
                {!this.props.walletAddress ? <button className="button-base button-primary" onClick={this.openWallet}>Connect wallet</button> : null}
                {this.props.walletAddress ? this.renderConnected() : null}
                <RpcSettings />
                {!this.props.walletAddress ? (
                    <div className = "notice-box" style = {{ marginTop: "12px" }}>
                        <div className = "helper-text">Nothing moves until your wallet is connected. This keeps the screen clean and avoids accidental actions.</div>
                    </div>
                ) : null}
            </div>
        );
    }
});