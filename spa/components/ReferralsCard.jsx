var ReferralsCard = React.createClass({
    getInitialState: function() {
        return {toAdd: '', toRemove: '', pending: false, message: ''};
    },
    submit: async function() {
        var session = requireWalletSession();
        this.setState({pending: true, message: ''});
        try {
            await this.props.onManage(this.state.toAdd, this.state.toRemove);
            if(session.active) this.setState({toAdd: '', toRemove: '', message: 'Referrals updated.'});
        } catch(e) {
            if(session.active) this.setState({message: e.message || String(e)});
        } finally {
            if(session.active) this.setState({pending: false});
        }
    },
    render: function() {
        return <div className="glass-card card-pad">
            <h3 className="card-title">Manage referrals</h3>
            <div className="card-copy">Enable or revoke permission to deposit for other wallets. Separate addresses with commas or new lines. Removal takes precedence if an address appears in both lists.</div>
            <div className="form-stack">
                {[['toAdd', 'Enable referrals'], ['toRemove', 'Revoke referrals']].map(([key, label]) => <div className="field-shell" key={key}>
                    <label className="field-label" htmlFor={'referrals-' + key}>{label}</label>
                    <textarea id={'referrals-' + key} className="manager-address-input" rows="3" value={this.state[key]} disabled={this.state.pending} onChange={e => this.setState({[key]: e.target.value})} placeholder="0x…" />
                </div>)}
                <button className="button-base button-primary" onClick={this.submit} disabled={this.state.pending || (!this.state.toAdd.trim() && !this.state.toRemove.trim())}>{this.state.pending ? 'Updating…' : 'Update referrals'}</button>
                {this.state.message ? <div className="muted-2" role="status" style={{overflowWrap: 'anywhere'}}>{this.state.message}</div> : null}
            </div>
        </div>;
    }
});
