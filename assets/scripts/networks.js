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

window.readImpersonationHistory = function() {
    var entries;
    try { entries = JSON.parse(localStorage.getItem('dabotto:impersonationHistory') || '[]'); } catch(e) { return []; }
    return Array.isArray(entries) ? entries.filter(entry => entry && typeof entry.name === 'string' && web3utils.isAddress(entry.address)) : [];
};

window.updateImpersonationHistory = function(address, name) {
    address = web3utils.toChecksumAddress(address.trim());
    var entries = readImpersonationHistory();
    var existing = entries.find(entry => entry.address.toLowerCase() === address.toLowerCase());
    if(name === null) entries = entries.filter(entry => entry.address.toLowerCase() !== address.toLowerCase());
    else if(existing) { if(name !== undefined) existing.name = name.trim(); }
    else entries.push({ name: (name || '').trim(), address });
    localStorage.setItem('dabotto:impersonationHistory', JSON.stringify(entries));
    return entries;
};

window.impersonate = function(address) {
    if(address !== undefined && address !== null && address !== '') {
        if(typeof address !== 'string' || !web3utils.isAddress(address.trim())) throw new Error('Invalid wallet address.');
        updateImpersonationHistory(address);
        sessionStorage.setItem('dabotto:impersonate', web3utils.toChecksumAddress(address.trim()));
    } else {
        sessionStorage.removeItem('dabotto:impersonate');
    }
    invalidateWalletSession();
    window.location.reload();
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
    var readRpc = readNetworkPreference('managerReadRpc');
    var readSelectors = window.context.ManagerABI.filter(entry => entry.type === 'function' && ['status', 'pools'].includes(entry.name)).map(entry => web3.eth.abi.encodeFunctionSignature(entry).toLowerCase());
    var rpcLimited = false;
    async function managerRead(request) {
        if(rpcLimited) throw new Error('Custom RPC quota reached. Update the RPC configuration to resume.');
        var abort = new AbortController();
        var timeout = setTimeout(() => abort.abort(), 30000);
        try {
            var response = await fetch(readRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: request.method, params: request.params }),
                signal: abort.signal
            });
            if(response.status === 429) rpcLimited = true;
            if(!response.ok) throw new Error('Custom RPC HTTP error ' + response.status);
            var payload = await response.json();
            if(payload.error) {
                if(payload.error.code === -32005 || /quota|rate limit|too many requests/i.test(payload.error.message || '')) rpcLimited = true;
                throw new Error(payload.error.message || 'Custom RPC request failed.');
            }
            if(typeof payload.result !== 'string') throw new Error('Invalid custom RPC response.');
            return payload.result;
        } finally {
            clearTimeout(timeout);
        }
    }
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
            var call = request.method === 'eth_call' && request.params && request.params[0];
            var useReadRpc = readRpc && call && (call.to || '').toLowerCase() === window.context.managerAddress.toLowerCase() && readSelectors.includes((call.data || '').slice(0, 10).toLowerCase());
            var result = await (useReadRpc ? managerRead(request) : provider.request(request));
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
