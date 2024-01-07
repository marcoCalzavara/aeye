import error_image from "./assets/error_page.jpg";
import {SlHome} from "react-icons/sl";
import {Link} from "react-router-dom";

export default function ErrorPage() {
    return (
        <div id="error-page" className="text-white w-screen h-screen flex flex-col items-center justify-center" style={
            {
                backgroundImage: `url(${error_image})`
            }
        }>
            <h1 style={
                {
                    fontSize: "calc(min(10vw, 10vh))",
                    fontFamily: "Roboto Slab, serif",
                    fontWeight: "bold",
                    textAlign: "center"
                }
            }>
                Oops!
            </h1>
            <p style={
                {
                    fontSize: "calc(min(3vw, 3vh))",
                    fontFamily: "Roboto Slab, serif",
                    textAlign: "center",
                    marginTop: "2%",
                    marginBottom: "2%"
                }
            }>
                Sorry, you are in unknown territory.
            </p>
            <div className="flex flex-row items-center justify-center w-full">
                <p style={
                    {
                        fontSize: "calc(min(3vw, 3vh))",
                        fontFamily: "Roboto Slab, serif",
                        textAlign: "center"
                    }
                }>
                    Go back
                </p>
                <Link to="/" style={
                    {
                        paddingLeft: "0.5%",
                    }
                }>
                    <SlHome style={
                        {
                            width: "calc(min(3vw, 3vh))",
                            height: "calc(min(3vw, 3vh))",
                        }
                    }/>
                </Link>
            </div>
        </div>
    );
}