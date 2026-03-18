var HarvestCycle = React.createClass({
    refreshEvery: 10 * 60 * 1000,
    getInitialState: function() {
        return { now: Date.now(), policy: null, error: false };
    },
    componentDidMount: function() {
        var self = this;
        this.timer = setInterval(function() { self.setState({ now: Date.now() }); }, 30000);
        this.policyTimer = setInterval(this.loadPolicy, this.refreshEvery);
        this.loadPolicy();
    },
    componentWillUnmount: function() {
        this.disposed = true;
        clearInterval(this.timer);
        clearInterval(this.policyTimer);
    },
    loadPolicy: function() {
        var self = this;
        if (!this.props.loadPolicy) return;
        Promise.resolve(this.props.loadPolicy()).then(function(policy) {
            if (!self.disposed) self.setState({ policy: policy, error: false, now: Date.now() });
        }, function(e) {
            if (!self.disposed) self.setState({ error: !self.state.policy });
            console.log(e);
        });
    },
    formatTime: function(ms) {
        return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    },
    formatDuration: function(ms) {
        var minutes = Math.max(1, Math.ceil(ms / 60000));
        var hours = Math.floor(minutes / 60);
        minutes = minutes % 60;
        return ((hours ? hours + " h " : "") + (minutes ? minutes + " min" : "")).trim();
    },
    renderFigures: function() {
        var symbol = this.props.symbol || "";
        if (!this.props.toBeCollected) return null;
        return <div className = "harvest-figures">
            <div className = "harvest-figure">
                <span className = "harvest-figure-label">Fees accruing</span>
                <span className = "harvest-figure-value">{this.props.toBeCollected} <small>{symbol}</small></span>
            </div>
            {this.props.pendingPayout ? <div className = "harvest-figure">
                <span className = "harvest-figure-label">Of which at the next payout</span>
                <span className = "harvest-figure-value">{this.props.pendingPayout} <small>{symbol}</small></span>
            </div> : null}
        </div>;
    },
    renderShell: function(copy, side, track) {
        return <section className = "glass-card card-pad harvest-cycle" aria-label = "Harvest cycle">
            <div className = "harvest-head">
                <div>
                    <h2 className = "card-title">Harvest cycle</h2>
                    <div className = "card-copy">{copy}</div>
                </div>
                {side}
            </div>
            {track}
            {this.renderFigures()}
        </section>;
    },
    render: function() {
        var policy = this.state.policy;
        if (!policy) {
            return this.renderShell(this.state.error ? "The harvest policy could not be read from the contract." : "Reading the harvest policy from the contract" + String.fromCharCode(0x2026), null, null);
        }
        if (!policy.enabled || !(policy.harvestGap > 0)) {
            return this.renderShell(policy.enabled ? "Fees earned by the positions are paid into the farming at every pool sync." : "Harvest windows are not active on this network.", null, null);
        }
        var size = policy.harvestGap * 1000;
        var day = 24 * 60 * 60 * 1000;
        var count = day % size === 0 && day / size <= 12 ? day / size : 6;
        var now = policy.chainTime + (this.state.now - policy.readAt);
        var cycleStart = Math.floor(now / (size * count)) * size * count;
        var current = Math.floor((now - cycleStart) / size);
        var next = cycleStart + (current + 1) * size;
        var progress = Math.round(((now - cycleStart) % size) / size * 100);
        var segments = [];
        for (var i = 0; i < count; i++) {
            segments.push(<div key = {i} className = {"harvest-segment" + (i < current ? " is-past" : i === current ? " is-current" : "")}>
                <div className = "harvest-segment-bar">{i === current ? <div className = "harvest-segment-fill" style = {{ width: progress + "%" }}></div> : null}</div>
                <div className = "harvest-segment-time">{this.formatTime(cycleStart + (i + 1) * size)}</div>
            </div>);
        }
        var side = <div className = "harvest-next">
            <span className = "harvest-next-label">Next window opens</span>
            <strong className = "harvest-next-time">{this.formatTime(next)}</strong>
            <span className = "harvest-next-remaining">in {this.formatDuration(next - now)}</span>
        </div>;
        var track = <div className = "harvest-track" style = {{ gridTemplateColumns: "repeat(" + count + ", minmax(0, 1fr))" }} role = "img" aria-label = {"Window " + (current + 1) + " of " + count + ", " + progress + "% elapsed"}>{segments}</div>;
        return this.renderShell("Every " + this.formatDuration(size) + " a new window opens: fees earned by each position are paid into the farming at its first sync after that time.", side, track);
    }
});
