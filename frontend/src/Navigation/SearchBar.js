import React from "react";
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import "./SearchBar.css"
import {InputBase} from "@mui/material";


export class SearchBar extends React.Component {
    // Props are objects used by components to communicate with each other
    constructor(props) {
        super(props);
        this.state = {
            searchHistory: [],
            shownSearchHistory: [],
            inputValue: "",
            anchorEl: null,
            open: false
        };
        this.max_state_length = 20;
        this.max_history_shown = 5
    }

    // Save the input of the user. The state is then used to show the latest things that have been searched.
    updateSearchHistory = () => {
        this.setState((prevState) => {
            let updatedSearchHistory = []
            if (!prevState.searchHistory.includes(prevState.inputValue))
                updatedSearchHistory = [prevState.inputValue, ...prevState.searchHistory];
            else
                updatedSearchHistory = prevState.searchHistory;

            if (updatedSearchHistory.length > this.max_state_length) {
                updatedSearchHistory = updatedSearchHistory.slice(0, this.max_state_length);
            }
            // Update searchText
            this.setState({searchHistory: updatedSearchHistory});
        });
    };

    sendText = () => {
        // Send text to web server
    };

    // Handle changes in input to the search bar.
    handleInputChange = (event) => {
        let search = event.target.value;
        // Filter out from possible search result those that don't match the current string
        let newShownSearchHistory = [];
        for (let str of this.state.searchHistory) {
            if (!(search === "") && str.toLowerCase().startsWith(search.toLowerCase())) {
                newShownSearchHistory.push(str);
            }
            if (newShownSearchHistory.length === this.max_history_shown)
                break;
        }

        this.setState({shownSearchHistory: newShownSearchHistory, inputValue: search});

    };

    handleEnter = (event) => {
        if (event.key === 'Enter') {
            this.handleClickSearch(event);
        }
    }

    handleMouseLeave = (event) => {
        this.setState({shownSearchHistory: [], open: false});
    }

    handleClickSearch = (event) => {
        // The search history is updated only when the user clicks on the search icon
        this.updateSearchHistory();
        // Clear inputValue and currentSearchText
        this.setState({shownSearchHistory: [], inputValue: "", open: false});
        // Send the text in this.state.inputValue to the server
        this.sendText();
    };

    handleClickHistory = (text) => {
        this.setState({inputValue: text});
    }

    handleClick = (event) => {
        this.setState((prevState) => {
            return {anchorEl: event.currentTarget, open: !prevState.open};
        })
    }

    searchBar = () => {
        return (
            <div className="search-bar">
                {/*98% for input, 2% for search icon */}
                <InputBase
                    className="input"
                    label={"Search Images by Text"}
                    placeholder={"\"A painting of a dog\""}
                    value={this.state.inputValue}
                    onChange={this.handleInputChange}
                    onKeyDown={this.handleEnter}
                    onClick={this.handleClick}
                />
                <IconButton type="button" className="search" aria-label="search" onClick={this.handleClickSearch}>
                    <SearchIcon/>
                </IconButton>
            </div>
        )
    }


    render() {
        return (
            this.searchBar()
        );
    }
}

/*
* {this.state.shownSearchHistory && this.state.shownSearchHistory.map((item, index) => (
                            <MenuItem key={index} onClick={() => this.handleClickHistory(item)}>
                                {item}
                            </MenuItem>
                        ))}
* */
