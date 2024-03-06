import './index.css';
import React, {useEffect, useState} from 'react';
import Home from "./Pages/Home";
import About from "./Pages/About";


function App() {
    // Define state for which page to show
    const [page, setPage] = useState("home");
    // Define state for search bar click. When the user clicks anywhere on the page, the search bar should move to its
    // position and the app should become usable.
    const [searchBarIsClicked, setSearchBarIsClicked] = useState(false);

    useEffect(() => {
        // Define event listener to handle click on the page. The event handler will be removed after the first click.
        const handleClick = (event) => {
            if ((event.target.id === "search-bar-id" || event.target.id === "search-button"
                    || event.target.id === "search-button-icon") && event.type !== "wheel")
                return;
            if (!searchBarIsClicked)
                setSearchBarIsClicked(true);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('wheel', handleClick);
        }

        // Add event listener to handle click or touch on the page or mouse wheel.
        window.addEventListener('click', handleClick);
        window.addEventListener('wheel', handleClick);
    }, []);

    return (
        <>
          <Home page={page} setPage={setPage} searchBarIsClicked={searchBarIsClicked} setSearchBarIsClicked={setSearchBarIsClicked}/>
          <About page={page} setPage={setPage}/>
        </>
    );
}


export default App;
