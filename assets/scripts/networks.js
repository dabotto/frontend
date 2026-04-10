window.getAppNetwork = function(chainId) {
    return window.context.networks[Number(chainId === undefined ? window.chainId : chainId)];
};

window.networkStorageKey = function(key) {
    return 'dabotto:' + window.chainId + ':' + key;
};

window.readNetworkPreference = function(key) {
    return localStorage.getItem(networkStorageKey(key));
};

window.writeNetworkPreference = function(key, value) {
    localStorage.setItem(networkStorageKey(key), value);
};

window.initializeAppNetwork = function() {
    var saved = Number(localStorage.getItem('dabotto:chainId'));
    window.chainId = getAppNetwork(saved) ? saved : 8453;
    document.documentElement && document.documentElement.setAttribute('data-chain', window.chainId);
    window.context.managerAddress = getAppNetwork().managerAddress;
    window.DEFAULT_TOKEN_ADDRESSES = getAppNetwork().defaultTokenAddresses;
    window.DEFAULT_TOKEN_REGISTRY = getAppNetwork().tokenRegistry;
    if(window.chainId === 8453 && !localStorage.getItem('dabotto:baseMigrated')) {
        ['referenceTokenAddress', 'addLiquidityTokenAddress', 'tokenMetaCache', 'customTokenAddresses'].forEach(function(key) {
            var old = localStorage.getItem(key);
            if(old !== null && readNetworkPreference(key) === null) writeNetworkPreference(key, old);
        });
        localStorage.setItem('dabotto:baseMigrated', 'true');
    }
};

window.invalidateWalletSession = function() {
    if(window.walletSession) window.walletSession.active = false;
    if(window.indexContext) clearTimeout(window.indexContext.timeout);
};

window.reloadAppNetwork = function(chainId) {
    invalidateWalletSession();
    if(getAppNetwork(chainId)) localStorage.setItem('dabotto:chainId', Number(chainId));
    window.location.reload();
};

window.requireWalletSession = function() {
    var session = window.walletSession;
    if(!session || !session.active || session.chainId !== window.chainId) {
        throw new Error('Connect your wallet to the selected network.');
    }
    return session;
};

window.createWalletSession = function(provider, chainId, address) {
    invalidateWalletSession();
    var session = { provider, chainId: Number(chainId), address, active: true };
    window.walletSession = session;
    var guarded = {
        request: async function(request) {
            if(!session.active) throw new Error('Wallet network or account changed.');
            if(request.method === 'eth_sendTransaction') {
                var actualChain = Number(await provider.request({ method: 'eth_chainId' }));
                var accounts = await provider.request({ method: 'eth_accounts' });
                var tx = request.params[0];
                if(!session.active || actualChain !== session.chainId || (accounts[0] || '').toLowerCase() !== session.address.toLowerCase() || (tx.from || '').toLowerCase() !== session.address.toLowerCase()) {
                    throw new Error('Wallet network or account changed. Reconnect before sending.');
                }
                tx.chainId = '0x' + session.chainId.toString(16);
            }
            var result = await provider.request(request);
            if(!session.active) throw new Error('Wallet network or account changed.');
            return result;
        },
        on: function(name, callback) { provider.on && provider.on(name, callback); },
        removeListener: function(name, callback) { provider.removeListener && provider.removeListener(name, callback); }
    };
    guarded.send = guarded.sendAsync = function(payload, callback) {
        var batch = Array.isArray(payload);
        Promise.all((batch ? payload : [payload]).map(async function(entry) {
            var result = await guarded.request({ method: entry.method, params: entry.params || [] });
            return { jsonrpc: '2.0', id: entry.id, result };
        })).then(function(results) {
            callback(null, batch ? results : results[0]);
        }, function(error) { callback(error); });
    };
    window.web3 = new Web3Browser(guarded);
    return session;
};

window.getAppKitNetworks = function() {
    return Object.values(window.context.networks).map(function(network) {
        return {
            id: network.id,
            name: network.name,
            chainNamespace: 'eip155',
            caipNetworkId: 'eip155:' + network.id,
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: { default: { http: [] } },
            blockExplorers: { default: { name: network.name + ' Explorer', url: network.explorerUrl } }
        };
    });
};

window.walletTransport = function(chainId) {
    return function() {
        return {
            config: { key: 'wallet', name: 'Connected wallet', type: 'custom', retryCount: 0 },
            request: async function(request) {
                var session = requireWalletSession();
                if(session.chainId !== chainId) throw new Error('Wallet is on another network.');
                var result = await session.provider.request(request);
                if(!session.active) throw new Error('Wallet network or account changed.');
                return result;
            }
        };
    };
};