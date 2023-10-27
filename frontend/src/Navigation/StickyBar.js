import React, {useState, useEffect} from 'react';
import {SearchBar} from "./SearchBar";
import Link from '@mui/material/Link';
import SelectDataset from "./SelectDataset";
import {Logo} from "./Logo";
import "StickyBar.css"


const StickyBar = (props) => {

    const [scrolled, setScrolled] = useState(false)
    // Define height in pixels
    const heightNavBar = 100

    const handleScroll = () => {
        if (window.scrollY >= heightNavBar) {
            setScrolled(true);
        } else {
            setScrolled(false);
        }
    }

    useEffect(() => {
        window.addEventListener("scroll", handleScroll)
    });

    return (
        <div className={scrolled ? "navbar scrolled" : "navbar"}>
            <Logo/>
            <SearchBar/>
            <Link href="https://disco.ethz.ch/"
                  underline={"none"}
                  sx={{color: "#D1B000FF", fontSize: "large", fontWeight: "bold"}}
            >
                DISCOLab
            </Link>
            <SelectDataset/>
        </div>
    );
}

export default StickyBar;