var ImpersonationCard = React.createClass({
    getInitialState: function() {
        return { entries: readImpersonationHistory(), name: '', address: '', error: '' };
    },
    updateEntry: function(address, name) {
        try {
            this.setState({ entries: updateImpersonationHistory(address, name), error: '' });
        } catch(e) {
            this.setState({ error: e.message || String(e) });
        }
    },
    impersonate: function(address, name) {
        try {
            if(name !== undefined) updateImpersonationHistory(address, name);
            window.impersonate(address);
        } catch(e) {
            this.setState({ error: e.message || String(e) });
        }
    },
    render: function() {
        var active = sessionStorage.getItem('dabotto:impersonate') || '';
        var activeEntry = this.state.entries.find(entry => entry.address.toLowerCase() === active.toLowerCase());
        return <div className="glass-card card-pad" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <h2 className="card-title">Impersonate wallet</h2>
            <div className="helper-text" style={{ margin: '12px 0', minWidth: 0, overflowWrap: 'anywhere' }} role="status">{active ? <span>Impersonating: <a href={getEtherscanAddress("address/" + active)} target="_blank" rel="noopener noreferrer" title={active}>{activeEntry && activeEntry.name ? <span>{activeEntry.name}<i className="fa-solid fa-circle" aria-hidden="true" style={{ fontSize: '4px', margin: '0 6px', verticalAlign: 'middle' }}></i></span> : null}{shortAddress(active)}</a></span> : 'Using your connected wallet'}</div>
            <div id="impersonation-content">
            <div className="card-copy">View another wallet's settings. Saved wallets are shared across networks. Names are saved when you leave the field.</div>
            <button type="button" className="button-base button-secondary" disabled={!active} onClick={() => this.impersonate()}>Stop impersonating</button>
            <form className="form-stack" style={{ marginTop: '16px', minWidth: 0 }} onSubmit={event => { event.preventDefault(); this.impersonate(this.state.address, this.state.name); }}>
                <div className="field-shell" style={{ minWidth: 0 }}>
                    <label className="field-label" htmlFor="impersonation-name">Name (optional)</label>
                    <input id="impersonation-name" className="manager-address-input" value={this.state.name} onChange={event => this.setState({ name: event.target.value })} />
                    <label className="field-label" htmlFor="impersonation-address">Wallet address</label>
                    <input id="impersonation-address" className="manager-address-input" required value={this.state.address} onChange={event => this.setState({ address: event.target.value })} placeholder="0x..." autoComplete="off" spellCheck={false} />
                </div>
                <button type="submit" className="button-base button-primary">Impersonate wallet</button>
            </form>
            <div className="form-stack" style={{ marginTop: '16px', minWidth: 0 }}>
                {this.state.entries.map(entry => <div className="field-shell" key={entry.address} style={{ minWidth: 0 }}>
                    <label className="field-label" htmlFor={'impersonation-' + entry.address}>Saved wallet name</label>
                    <input id={'impersonation-' + entry.address} className="manager-address-input" defaultValue={entry.name} placeholder="Name (optional)" onBlur={event => this.updateEntry(entry.address, event.target.value)} />
                    <div className="helper-text" style={{ overflowWrap: 'anywhere' }}><a href={getEtherscanAddress("address/" + entry.address)} target="_blank" rel="noopener noreferrer">{entry.address}</a></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        <button type="button" className="button-base button-secondary" style={{ flex: '1 1 160px' }} aria-pressed={active.toLowerCase() === entry.address.toLowerCase()} onClick={() => this.impersonate(entry.address)}>{active.toLowerCase() === entry.address.toLowerCase() ? 'Impersonating this wallet' : 'Impersonate'}</button>
                        <button type="button" className="button-base button-secondary" style={{ flex: '1 1 100px' }} onClick={() => this.updateEntry(entry.address, null)}>Remove</button>
                    </div>
                </div>)}
            </div>
            {this.state.error ? <div className="notice-box" role="alert">{this.state.error}</div> : null}
            </div>
        </div>;
    }
});
