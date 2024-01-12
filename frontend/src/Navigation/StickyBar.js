import React, {useRef} from 'react';
import SearchBar from "./SearchBar";
import {Spin as Hamburger} from 'hamburger-react'


const StickyBar = (props) => {
    const setSearchData = useRef(props.setSearchData);

    return (
        <div
            id="sticky-bar"
            className={`fixed top-0 w-full h-sticky flex flex-row justify-between items-center flex-gaps-1 bg-zinc-950
             px-1/80 border-b-2 border-zinc-800 z-20 hover:opacity-100 transition-opacity duration-300 ${props.menuOpen ? 'opacity-100' : 'opacity-10'}`}>
            <div className="w-1/10 h-2/3">
                <a href="https://disco.ethz.ch/"
                   className="w-full h-full text-white text-lg md:text-xl font-bold flex items-center"
                   style={
                    {
                        fontFamily: "Brush Script MT, cursive",
                    }
                }>
                    DISCOLab
                </a>
            </div>
            {props.hasSearchBar &&
                <SearchBar host={props.host} setSearchData={setSearchData.current}
                           setShowCarousel={props.setShowCarousel}
                           selectedDataset={props.selectedDataset}/>
            }
            <div className="w-1/10 h-2/3 flex flex-row justify-end">
                <Hamburger color={"white"} toggle={props.setMenuOpen} toggled={props.menuOpen}/>
            </div>

        </div>
    );
}

export default StickyBar;