/* Create component for the menu */
import React, {useEffect, useState} from 'react';
import {slide as Menu} from 'react-burger-menu'
import './hamburgerMenu.css';
import SelectDataset from "./SelectDataset";
import {Link} from "react-router-dom";
import {SlHome, SlQuestion} from "react-icons/sl";
import {iconStyle, itemsStyle} from "../styles";
import {getResponsiveHeight} from "../utilities";


const HamburgerMenu = (props) => {
    const [opacity, setOpacity] = useState(1);

    const handleScroll = () => {
        const newOpacity = window.scrollY > getResponsiveHeight().replace("px", "") ? 0.1 : 1;
        setOpacity(newOpacity);
    };

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div style={
            {
                opacity: opacity,
            }
        }>
            <Menu id="hamburger-menu" isOpen={props.menuOpen} right
                  customBurgerIcon={false}
                  customCrossIcon={false}
                  noOverlay>
                <Link to="/" onClick={() => props.setMenuOpen(false)}>
                    <div className="flex flex-row items-center justify-items-start w-full">
                        <SlHome style={iconStyle}/>
                        <h1 style={itemsStyle}>
                            Home
                        </h1>
                    </div>
                </Link>
                <Link to="/about" onClick={() => props.setMenuOpen(false)}>
                    <div className="flex flex-row items-center justify-items-start w-full">
                        <SlQuestion style={iconStyle}/>
                        <h1 style={itemsStyle}>
                            About
                        </h1>
                    </div>
                </Link>
                <SelectDataset datasets={props.datasets} setSelectedDataset={props.setSelectedDataset}/>
            </Menu>
        </div>
    );
};

export default HamburgerMenu;