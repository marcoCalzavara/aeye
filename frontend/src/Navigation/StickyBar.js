import React, {useEffect, useRef} from 'react';
import SearchBar from "./SearchBar";
import SelectDataset from "./SelectDataset";


const StickyBar = (props) => {
    // Define height in pixels
    const heightNavBar = 150;
    const setSearchData = useRef(props.setSearchData);

    const onPointerOver = () => {
        let element = document.getElementById('sticky-bar'); // Replace with the ID of your element
        element.classList.remove('opacity-10');
        element.classList.add('opacity-100');
    };

    const onPointerLeave = () => {
        let element = document.getElementById('sticky-bar'); // Replace with the ID of your element
        element.classList.remove('opacity-100');
        element.classList.add('opacity-10');
    }

    return (
        <div
            id="sticky-bar"
            className="fixed top-0 w-full h-sticky flex flex-row justify-between items-center flex-gaps-1 bg-zinc-950
             px-1/80 border-b-2 border-zinc-800 z-20 opacity-10 hover:opacity-100"
             onPointerOver={onPointerOver}
             onPointerLeave={onPointerLeave}
        >
            <div className="w-2/19 h-2/3">
                <a href="https://disco.ethz.ch/" className="w-full h-full text-white text-lg md:text-xl font-bold flex items-center"
                   style={{textDecoration: "none"}}>
                    DISCOLab
                </a>
            </div>
            <SearchBar host={props.host} setSearchData={setSearchData.current} setShowCarousel={props.setShowCarousel}/>
            <SelectDataset datasets={props.datasets} setSelectedDataset={props.setSelectedDataset}/>
        </div>
    );
}

export default StickyBar;