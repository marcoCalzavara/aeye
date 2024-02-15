import './index.css';
import React, { useState} from 'react';
import Home from "./Pages/Home";
import About from "./Pages/About";


function App() {
    // Define state for which page to show
    const [page, setPage] = useState("home");

    return (
        <>
          <Home page={page} setPage={setPage}/>
          <About page={page} setPage={setPage}/>
        </>

    );
}


export default App;
