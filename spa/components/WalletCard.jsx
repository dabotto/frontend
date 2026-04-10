var WalletCard = React.createClass({
    getInitialState: function() { return { switching: false, error: '' }; },
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
        this.unsubscribers = ['subscribeState', 'subscribeAccount', 'subscribeNetwork', 'subscribeProviders'].filter(name => typeof walletModal[name] === 'function').map(name => walletModal[name](() => self.syncWallet()));
        this.syncWallet();
    },
    componentWillUnmount: function() {
        this.disposed = true;
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
            <div className = "action-grid">
                <div className = "balance-box">
                    <div className = "field-label">Wallet connected</div>
                    <div style = {{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "8px" }}>
                        <div>
                            <a className="position-address-link" href = {getEtherscanAddress("address/" + this.props.walletAddress)} target="_blank" style = {{ fontWeight: 700 }}>{shortAddress(this.props.walletAddress)} <i className = "fa-solid fa-arrow-up-right-from-square"></i></a>
                        </div>
                        <div className = "status-pill success"><a href="javascript:;" onClick={() => window.walletModal.open({view:"Account"})}>Manage</a></div>
                    </div>
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
                {this.state.switching ? <div className="helper-text" role="status">Confirm the network switch in your wallet…</div> : null}
                {this.state.error ? <div className="notice-box" role="alert">{this.state.error}</div> : null}
                {!this.props.walletAddress ? <button className="button-base button-primary" onClick={() => walletModal.open({view: 'Connect'})}>Connect wallet</button> : null}
                {this.props.walletAddress ? this.renderConnected() : null}
                {!this.props.walletAddress ? (
                    <div className = "notice-box" style = {{ marginTop: "12px" }}>
                        <div className = "helper-text">Nothing moves until your wallet is connected. This keeps the screen clean and avoids accidental actions.</div>
                    </div>
                ) : null}
            </div>
        );
    }
});
