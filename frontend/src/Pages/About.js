/* Page for the About section of the website */
import React, {useState} from 'react';
import StickyBar from "../Navigation/StickyBar";
import {getResponsiveHeight} from "../utilities";
import HamburgerMenu from "../Navigation/HamburgerMenu";

const About = (props) => {
    // Define state for menu open
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div hidden={props.page !== "about"}>
            <StickyBar hasSearchBar={false}
                       menuOpen={menuOpen}
                       setMenuOpen={setMenuOpen}/>
            <div id="about-page" style={
                {
                    position: "absolute",
                    backgroundColor: "white",
                    textDecorationColor: "black",
                    top: getResponsiveHeight(),
                    width: "100%",
                    height: "100%",
                }
            }>
                <HamburgerMenu menuOpen={menuOpen} setMenuOpen={setMenuOpen} setPage={props.setPage}/>
                About page yet to be implemented.
            </div>
        </div>
    );
}

export default About;