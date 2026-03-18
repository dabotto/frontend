var RpcSettings = React.createClass({
    getInitialState: function() {
        return { open: false, endpoint: readNetworkPreference('managerReadRpc') || '', error: '' };
    },
    save: function(event) {
        event.preventDefault();
        var endpoint = this.state.endpoint.trim();
        try {
            if(endpoint && !['http:', 'https:'].includes(new URL(endpoint).protocol)) throw new Error();
        } catch(e) {
            return this.setState({ error: 'Enter a valid HTTP or HTTPS URL.' });
        }
        try {
            if(endpoint) writeNetworkPreference('managerReadRpc', endpoint);
            else localStorage.removeItem(networkStorageKey('managerReadRpc'));
            reloadAppNetwork(window.chainId);
        } catch(e) {
            this.setState({ error: 'Unable to save the RPC configuration.' });
        }
    },
    render: function() {
        return <div style={{ marginTop: '12px', minWidth: 0, overflowWrap: 'anywhere' }}>
            <button type="button" className="button-base button-secondary" aria-expanded={this.state.open} aria-controls="wallet-rpc-settings" onClick={() => this.setState({ open: !this.state.open })}>
                RPC settings<i className="fa-solid fa-circle" aria-hidden="true" style={{ fontSize: '4px', margin: '0 6px', verticalAlign: 'middle' }}></i>{readNetworkPreference('managerReadRpc') ? 'Custom' : 'Optional'}
            </button>
            {this.state.open ? <form id="wallet-rpc-settings" className="form-stack" style={{ marginTop: '12px', minWidth: 0 }} onSubmit={this.save}>
                <div className="field-shell" style={{ minWidth: 0 }}>
                    <label className="field-label" htmlFor="wallet-rpc-url">Optional RPC<i className="fa-solid fa-circle" aria-hidden="true" style={{ fontSize: '4px', margin: '0 6px', verticalAlign: 'middle' }}></i>{getAppNetwork().name}</label>
                    <input id="wallet-rpc-url" type="url" className="manager-address-input" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={this.state.endpoint} onChange={event => this.setState({ endpoint: event.target.value, error: '' })} placeholder="https://..." autoComplete="off" spellCheck={false} aria-describedby="wallet-rpc-help" />
                </div>
                <div id="wallet-rpc-help" className="helper-text">Used only to read manager status and pools on {getAppNetwork().name}. Leave empty to use your wallet. Saved separately for each network.</div>
                <button type="submit" className="button-base button-primary">Save RPC</button>
                {this.state.error ? <div className="notice-box" role="alert">{this.state.error}</div> : null}
            </form> : null}
        </div>;
    }
});
