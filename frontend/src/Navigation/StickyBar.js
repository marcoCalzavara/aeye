import React, {useRef} from 'react';
import SearchBar from "./SearchBar";
// import {Spin as Hamburger} from 'hamburger-react'
import {TfiClose, TfiInfoAlt} from "react-icons/tfi";
import {iconStyle} from "../styles";
import SelectDataset from "./SelectDataset";


const StickyBar = (props) => {
    const setSearchData = useRef(props.setSearchData);

    return (
        <div
            id="sticky-bar"
            className="fixed top-0 w-full h-sticky flex flex-row justify-between items-center flex-gaps-1 bg-transparent px-1/80">
            <div className="w-1/10 h-2/3"/>
            {props.hasSearchBar &&
                <SearchBar host={props.host} setSearchData={setSearchData.current}
                           setShowCarousel={props.setShowCarousel}
                           selectedDataset={props.selectedDataset}
                           searchBarIsClicked={props.searchBarIsClicked}
                />
            }
            <div className="w-1/10 h-2/3 flex flex-row justify-end">
                {/*<Hamburger color={"white"} toggle={props.setMenuOpen} toggled={props.menuOpen}/>*/}
                {
                    props.page === "home" &&
                    <div style={
                        {
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingTop: "3%",
                            paddingRight: "20%"
                        }
                    }>
                        <SelectDataset datasets={props.datasets} setSelectedDataset={props.setSelectedDataset}/>
                    </div>

                }
                {
                    props.page === "home" &&
                    <div onClick={() => {
                        props.setPage("about");
                    }} style={
                        {
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center"
                        }
                    }>
                        <TfiInfoAlt style={iconStyle}/>
                    </div>
                }
                {
                    props.page === "about" &&
                    <div onClick={() => {
                        props.setPage("home");
                    }} style={
                        {
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center"
                        }
                    }>
                        <TfiClose style={iconStyle}/>
                    </div>
                }
            </div>

        </div>
    );
}

export default StickyBar;