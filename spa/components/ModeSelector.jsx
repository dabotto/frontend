var ModeSelector = React.createClass({
    renderPill: function(mode, label, icon, disabled) {
        var active = this.props.mode === mode;
        return (
            <button disabled={disabled === true} className = {"button-base mode-pill" + (active ? " active" : "")} onClick = {function() { this.props.onChange(mode); }.bind(this)}>
                <i className = {icon}></i>
                {label}
            </button>
        );
    },
    render: function() {
        return (
            <div className = "mode-selector">                    
                {this.renderPill("addLiquidity", "Add Liquidity", "fa-solid fa-plus")}
                {this.renderPill("removeLiquidity", "Remove Liquidity", "fa-solid fa-minus", this.props.removeDisabled)}
            </div>
        );
    }
});
