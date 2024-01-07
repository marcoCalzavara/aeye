import './index.css';
import React from 'react';
import {BrowserRouter, Route, Routes} from "react-router-dom";
import Home from "./Pages/Home";
import About from "./Pages/About";
import ErrorPage from "./Pages/ErrorPage";


function App() {

    return (
        <BrowserRouter>
            <Routes>
                <Route exact path="/" element={<Home/>}/>
                <Route exact path="/about" element={<About/>}/>
                <Route path="/*" element={<ErrorPage/>}/>
            </Routes>
        </BrowserRouter>
    );
}


export default App;
