var CapitalCard = React.createClass({
    formatAgo: function(date) {
        if(!date) return "";
        for(var name of ["day", "hour", "minute"]) {
            var value = date[name + "s"];
            if(value != 0) return value + " " + name + (value === 1 ? "" : "s") + " ago";
        }
        return "";
    },
    getSignClass: function(raw) {
        if(raw === undefined || raw === null) return "";
        raw = String(raw).trim();
        if(/^-?0*$/.test(raw)) return "";
        return raw.indexOf("-") === 0 ? "is-negative" : "is-positive";
    },
    renderTile: function(label, value, unit, note, className) {
        return <div className = "runrate-item">
            <div className = "runrate-label">{label}</div>
            <div className = {"runrate-value" + (className ? " " + className : "")}>{value}{unit ? <small> {unit}</small> : null}</div>
            {note ? <div className = "runrate-note">{note}</div> : null}
        </div>;
    },
    render: function() {
        var summary = this.props.summary;
        var symbol = this.props.token ? this.props.token.symbol : "";
        return (
            <section className = "glass-card card-pad capital-card" aria-label = "Capital">
                <div className = "runrate-head">
                    <h2 className = "card-title">Capital</h2>
                </div>
                {!summary ? <div className = "card-copy">Loading{String.fromCharCode(0x2026)}</div> : <div className = "runrate-grid">
                    {this.renderTile("Still invested", summary.stillInvested, symbol, null, this.getSignClass(summary.stillInvestedRaw))}
                    {this.renderTile("Actual heritage", summary.heritageValue, symbol)}
                    {this.renderTile("Monitoring started", summary.monitorStart ? summary.monitorStart.targetDateFormatted : String.fromCharCode(0x2014), null, summary.monitorStart ? this.formatAgo(summary.monitorStart) + " " + String.fromCharCode(0xb7) + " resets every year" : null, "is-date")}
                    {this.renderTile(summary.accruingResetDate ? "Accruing reset date" : "Last monitor update", summary.accruingResetDate || summary.monitorEnd, null, summary.accruingResetDate ? summary.monitorEnd : null, "is-date")}
                </div>}
            </section>
        );
    }
});
