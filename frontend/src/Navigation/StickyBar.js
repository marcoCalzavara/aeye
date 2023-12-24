import React, {useEffect, useRef} from 'react';
import SearchBar from "./SearchBar";


const StickyBar = (props) => {
    // Define height in pixels
    const heightNavBar = 150;
    const setSearchData = useRef(props.setSearchData);

    useEffect(() => {
        window.addEventListener('scroll', function () {
            let element = document.getElementById('sticky-bar'); // Replace with the ID of your element
            if (!element) return;
            let scrollPosition = window.scrollY;
            if (scrollPosition > heightNavBar) { // Adjust the value as needed
                element.classList.add('opacity-10');
                element.classList.add('hover:opacity-100');
            } else {
                element.classList.remove('opacity-10');
                element.classList.remove('hover:opacity-100');
            }
        });
    });

    return (
        <div id="sticky-bar" className="fixed top-0 w-full 2xl:h-16 xl:h-14 md:h-14
               sm:h-12 xs:h-12  lg:h-50px flex flex-row justify-between items-center flex-gaps-1 bg-zinc-950 px-1/80
               border-b-2 border-zinc-800 z-20">
            <div className="w-2/19 h-2/3">
                <a href="https://disco.ethz.ch/" className="w-full h-full text-white text-lg md:text-xl font-bold flex items-center"
                   style={{textDecoration: "none"}}>
                    DISCOLab
                </a>
            </div>
            <SearchBar host="http://localhost:80" setSearchData={setSearchData.current}/>

        </div>
    );
}

export default StickyBar;