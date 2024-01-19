import './index.css';
import React, {useState} from 'react';
import {BrowserRouter, Route, Router, Routes} from "react-router-dom";
import Home from "./Pages/Home";
import About from "./Pages/About";
import ErrorPage from "./Pages/ErrorPage";
import {Switch} from "@mui/material";


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
