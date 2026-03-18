var ScrollTopButton = React.createClass({
    getInitialState() {
        return {
            visible : false
        }
    },
    componentDidMount() {
        window.addEventListener("scroll", this.onScroll, { passive : true });
        window.addEventListener("resize", this.onScroll);
        this.onScroll();
    },
    componentWillUnmount() {
        window.removeEventListener("scroll", this.onScroll);
        window.removeEventListener("resize", this.onScroll);
    },
    onScroll() {
        var visible = (window.scrollY || document.documentElement.scrollTop || 0) > 320;
        visible !== this.state.visible && this.setState({ visible });
    },
    scrollTop() {
        try {
            window.scrollTo({ top : 0, behavior : "smooth" });
        } catch(e) {
            window.scrollTo(0, 0);
        }
    },
    render() {
        return (
            <button type="button" className={"scroll-top-button" + (this.state.visible ? " is-visible" : "")} aria-label="Back to top" title="Back to top" tabIndex={this.state.visible ? 0 : -1} aria-hidden={!this.state.visible} onClick={this.scrollTop}>
                <i className="fa-solid fa-arrow-up" aria-hidden="true"></i>
            </button>
        );
    }
});
