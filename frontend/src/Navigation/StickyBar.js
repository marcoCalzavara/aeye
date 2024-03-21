import React, {useRef} from 'react';
import SearchBar from "./SearchBar";
// import {Spin as Hamburger} from 'hamburger-react'
import {TfiInfoAlt} from "react-icons/tfi";
import {iconStyle} from "../styles";
import SelectDataset from "./SelectDataset";


const StickyBar = (props) => {
    const setSearchData = useRef(props.setSearchData);

    return (
        <div
            id="sticky-bar"
            className="fixed top-0 w-full h-sticky flex flex-row justify-between items-center bg-transparent px-1/80 z-50 pointer-events-none"
            onClick={() => {
                if (props.page === "home")
                    props.setShowCarousel(false)
            }}>
            <div>
                <div style={
                    {
                        height: iconStyle.height,
                        width: iconStyle.width,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center"
                    }
                }>
                    <SelectDataset datasets={props.datasets} setSelectedDataset={props.setSelectedDataset}/>
                </div>
            </div>
            {props.hasSearchBar &&
                <SearchBar host={props.host} setSearchData={setSearchData.current}
                           setShowCarousel={props.setShowCarousel}
                           selectedDataset={props.selectedDataset}
                           searchBarIsClicked={props.searchBarIsClicked}
                           setSearchBarIsClicked={props.setSearchBarIsClicked}
                           searchBarIsBlocked={props.searchBarIsBlocked}
                           onGoingRequest={props.onGoingRequest}
                           setOnGoingRequest={props.setOnGoingRequest}
                />
            }
            <div>
                {/*<Hamburger color={"white"} toggle={props.setMenuOpen} toggled={props.menuOpen}/>*/}

                <div onClick={() => {
                    props.setPage("about");
                }} style={
                    {
                        height: iconStyle.height,
                        width: iconStyle.width,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "auto"
                    }
                }>
                    <TfiInfoAlt style={iconStyle}/>
                </div>
            </div>
        </div>
    );
}

export default StickyBar;