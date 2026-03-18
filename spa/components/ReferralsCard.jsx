var ReferralsCard = React.createClass({
    maxChecks: 25,
    getInitialState: function() {
        return { toAdd: '', toRemove: '', pending: false, result: null, statuses: {}, lookup: '', lookupStatus: null };
    },
    componentWillUnmount: function() {
        this.disposed = true;
        clearTimeout(this.checkTimer);
        clearTimeout(this.lookupTimer);
    },
    parse: function(value) {
        var seen = {};
        return value.trim().split(/[\s,;]+/).filter(Boolean).map(function(raw) {
            var valid = web3.utils.isAddress(raw);
            var address = valid ? web3.utils.toChecksumAddress(raw) : raw;
            var key = address.toLowerCase();
            var duplicate = !!seen[key];
            seen[key] = true;
            return { raw: raw, address: address, key: key, valid: valid, duplicate: duplicate };
        }).filter(function(entry) { return !entry.duplicate; });
    },
    isActive: function() {
        return !this.disposed && window.walletSession && window.walletSession.active;
    },
    check: function(address) {
        var self = this, key = address.toLowerCase();
        this.setState(function(state) { return { statuses: Object.assign({}, state.statuses, { [key]: 'checking' }) }; });
        return Promise.resolve(this.props.onCheck(address)).then(function(enabled) {
            return enabled === true || enabled === 'true' ? 'enabled' : 'disabled';
        }, function() { return 'unknown'; }).then(function(status) {
            if (self.isActive()) self.setState(function(state) { return { statuses: Object.assign({}, state.statuses, { [key]: status }) }; });
            return status;
        });
    },
    scheduleChecks: function() {
        var self = this;
        clearTimeout(this.checkTimer);
        this.checkTimer = setTimeout(function() {
            if (!self.isActive()) return;
            var entries = self.parse(self.state.toAdd).concat(self.parse(self.state.toRemove)).filter(function(entry) { return entry.valid; });
            entries.slice(0, self.maxChecks).forEach(function(entry) {
                if (!self.state.statuses[entry.key]) self.check(entry.address);
            });
        }, 500);
    },
    onField: function(key, value) {
        this.setState({ [key]: value, result: null }, this.scheduleChecks);
    },
    onLookup: function(value) {
        var self = this;
        clearTimeout(this.lookupTimer);
        this.setState({ lookup: value, lookupStatus: null });
        var address = value.trim();
        if (!address) return;
        if (!web3.utils.isAddress(address)) return this.setState({ lookupStatus: 'invalid' });
        this.setState({ lookupStatus: 'checking' });
        this.lookupTimer = setTimeout(function() {
            Promise.resolve(self.props.onCheck(address)).then(function(enabled) {
                return enabled === true || enabled === 'true' ? 'enabled' : 'disabled';
            }, function() { return 'unknown'; }).then(function(status) {
                if (self.isActive() && self.state.lookup.trim() === address) self.setState({ lookupStatus: status });
            });
        }, 400);
    },
    submit: async function() {
        var session = requireWalletSession();
        this.setState({ pending: true, result: null });
        try {
            await this.props.onManage(this.state.toAdd, this.state.toRemove);
            if (session.active) this.setState({ toAdd: '', toRemove: '', statuses: {}, lookupStatus: null, result: { ok: true, text: 'Referral permissions updated on ' + this.props.networkName + '.' } }, () => this.state.lookup.trim() && this.onLookup(this.state.lookup));
        } catch(e) {
            if (session.active) this.setState({ result: { ok: false, text: e.message || String(e) } });
        } finally {
            if (session.active) this.setState({ pending: false });
        }
    },
    renderStatus: function(status) {
        if (status === 'enabled') return <span className = "status-pill status-pill-green">Enabled</span>;
        if (status === 'disabled') return <span className = "status-pill status-pill-neutral">Not enabled</span>;
        if (status === 'invalid') return <span className = "status-pill status-pill-red">Invalid address</span>;
        if (status === 'checking') return <span className = "status-pill status-pill-neutral">Checking{String.fromCharCode(0x2026)}</span>;
        if (status === 'unknown') return <span className = "status-pill status-pill-neutral">Status unavailable</span>;
        return null;
    },
    renderEntries: function(entries, kind, conflicts) {
        if (!entries.length) return null;
        return <ul className = "ref-entries">
            {entries.map(function(entry) {
                var status = entry.valid ? this.state.statuses[entry.key] : 'invalid';
                var note = null;
                if (entry.valid && kind === 'add' && conflicts[entry.key]) note = 'Also in revoke: it will be revoked';
                else if (status === 'enabled' && kind === 'add') note = 'Already enabled';
                else if (status === 'disabled' && kind === 'remove') note = 'Not enabled: no change';
                return <li key = {entry.key} className = {"ref-entry" + (entry.valid ? "" : " is-invalid")}>
                    <span className = "ref-entry-address" title = {entry.address}>{entry.valid ? shortAddress(entry.address) : entry.raw}</span>
                    {note ? <span className = "ref-entry-note">{note}</span> : null}
                    {this.renderStatus(status)}
                </li>;
            }.bind(this))}
        </ul>;
    },
    renderField: function(key, kind, title, copy, entries, conflicts) {
        return <div className = {"ref-field ref-field-" + kind}>
            <div className = "ref-field-head">
                <span className = "ref-field-icon" aria-hidden = "true"><i className = {"fa-solid " + (kind === 'add' ? "fa-user-plus" : "fa-user-minus")}></i></span>
                <div>
                    <label className = "ref-field-title" htmlFor = {'referrals-' + key}>{title}</label>
                    <div className = "ref-field-copy">{copy}</div>
                </div>
                {entries.length ? <span className = "ref-field-count">{entries.length}</span> : null}
            </div>
            <textarea id = {'referrals-' + key} className = "manager-address-input ref-textarea" rows = "4" value = {this.state[key]} disabled = {this.state.pending} onChange = {e => this.onField(key, e.target.value)} placeholder = {"0x\u2026, 0x\u2026"} spellCheck = {false} autoComplete = "off" />
            {this.renderEntries(entries, kind, conflicts)}
        </div>;
    },
    render: function() {
        var additions = this.parse(this.state.toAdd), removals = this.parse(this.state.toRemove);
        var removalKeys = {};
        removals.forEach(function(entry) { if (entry.valid) removalKeys[entry.key] = true; });
        var conflicts = {};
        additions.forEach(function(entry) { if (entry.valid && removalKeys[entry.key]) conflicts[entry.key] = true; });
        var invalid = additions.concat(removals).filter(function(entry) { return !entry.valid; }).length;
        var grant = additions.filter(function(entry) { return entry.valid && !conflicts[entry.key]; }).length;
        var revoke = removals.filter(function(entry) { return entry.valid; }).length;
        var empty = !grant && !revoke;
        var canSubmit = !this.state.pending && !invalid && !empty;
        return <div className = "page-grid page-grid-split ref-layout">
            <section className = "glass-card card-pad ref-editor" aria-label = "Update referral permissions">
                <h2 className = "card-title">Update permissions</h2>
                <div className = "card-copy">Paste one or more wallet addresses, separated by commas, spaces or new lines. Both lists are sent in a single transaction.</div>
                <div className = "ref-fields">
                    {this.renderField('toAdd', 'add', 'Enable', 'Wallets that can deposit for others', additions, conflicts)}
                    {this.renderField('toRemove', 'remove', 'Revoke', 'Wallets that lose the permission', removals, {})}
                </div>
                <div className = "ref-footer">
                    <div className = "ref-summary" aria-live = "polite">
                        {empty && !invalid ? <span>No changes yet.</span> : <>
                            <span><strong>{grant}</strong> to enable</span>
                            <span><strong>{revoke}</strong> to revoke</span>
                            {invalid ? <span className = "ref-summary-error"><i className = "fa-solid fa-triangle-exclamation" aria-hidden = "true"></i>{invalid} invalid {invalid === 1 ? "address" : "addresses"}</span> : null}
                        </>}
                    </div>
                    <button className = "button-base button-primary ref-submit" onClick = {this.submit} disabled = {!canSubmit}>
                        {this.state.pending ? "Confirm in your wallet\u2026" : "Update referrals"}
                    </button>
                </div>
                {this.state.result ? <div className = {"ref-result " + (this.state.result.ok ? "is-ok" : "is-error")} role = {this.state.result.ok ? "status" : "alert"}>
                    <i className = {"fa-solid " + (this.state.result.ok ? "fa-circle-check" : "fa-circle-exclamation")} aria-hidden = "true"></i>
                    <span>{this.state.result.text}</span>
                </div> : null}
            </section>
            <div className = "ref-side">
                <section className = "glass-card card-pad" aria-label = "Check a wallet">
                    <h2 className = "card-title">Check a wallet</h2>
                    <div className = "card-copy">See whether an address can currently deposit for others.</div>
                    <div className = "ref-lookup">
                        <input className = "manager-address-input" value = {this.state.lookup} onChange = {e => this.onLookup(e.target.value)} placeholder = {"0x\u2026"} aria-label = "Wallet address to check" spellCheck = {false} autoComplete = "off" />
                        {this.state.lookupStatus ? <div className = "ref-lookup-result">{this.renderStatus(this.state.lookupStatus)}</div> : null}
                    </div>
                </section>
                <section className = "glass-card card-pad" aria-label = "How referrals work">
                    <h2 className = "card-title">How referrals work</h2>
                    <ul className = "ref-notes">
                        <li><i className = "fa-solid fa-hand-holding-dollar" aria-hidden = "true"></i><span>An enabled wallet can add liquidity for another wallet: the deposit increases that wallet's farming position.</span></li>
                        <li><i className = "fa-solid fa-network-wired" aria-hidden = "true"></i><span>Permissions apply to {this.props.networkName} only. Repeat the change on the other network if needed.</span></li>
                        <li><i className = "fa-solid fa-code-merge" aria-hidden = "true"></i><span>If an address is in both lists, it is revoked.</span></li>
                    </ul>
                </section>
            </div>
        </div>;
    }
});
