import React, {useEffect} from 'react';
import {SearchBar} from "./SearchBar";
import SelectDataset from "./SelectDataset";


const StickyBar = (props) => {
    // Define height in pixels
    const heightNavBar = 100

    useEffect(() => {
        window.addEventListener('scroll', function () {
            let element = document.getElementById('sticky-bar'); // Replace with the ID of your element
            let scrollPosition = window.scrollY;
            if (scrollPosition > heightNavBar) { // Adjust the value as needed
                element.classList.add('opacity-50 hover:opacity-100');
            } else {
                element.classList.remove('opacity-50 hover:opacity-100');
            }
        });
    });

    return (
        <div id="sticky-bar" className="fixed top-0 w-full 2xl:h-20 xl:h-16 lg:h-50px md:h-16
               sm:h-14 xs:h-12 min-w-screen flex flex-row justify-between items-center flex-gaps-1
               bg-black px-1/80">
            <div className="w-2/19 h-2/3">
                <a href="https://disco.ethz.ch/" className="w-full h-full text-yellow-600 text-sm md:text-xl
           lg:text-2xl font-bold flex items-center"
                   style={{textDecoration: "none"}}>
                    DISCOLab
                </a>
            </div>
            <div className="w-2/3 h-2/3">
                <SearchBar/>
            </div>
            <div className="w-2/19 h-2/3">
                <SelectDataset/>
            </div>
        </div>
    );
}

export default StickyBar;