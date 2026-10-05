<?php

session_start();

include("../config/database.php");


// =====================================================
// IF ALREADY LOGGED IN
// =====================================================

if (
    isset($_SESSION["user_id"]) &&
    isset($_SESSION["role"])
) {

    if ($_SESSION["role"] == "admin") {

        header("Location: ../admin/dashboard.php");
        exit();

    } elseif ($_SESSION["role"] == "doctor") {

        header("Location: ../doctor/dashboard.php");
        exit();

    } elseif ($_SESSION["role"] == "patient") {

        header("Location: ../patient/dashboard.php");
        exit();

    } else {

        // Invalid role - destroy session
        session_unset();
        session_destroy();

        header("Location: login.php");
        exit();
    }
}


// =====================================================
// LOGIN
// =====================================================

$error = "";

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $email = trim($_POST["email"]);
    $password = $_POST["password"];


    if ($email == "" || $password == "") {

        $error = "Please enter email and password.";

    } else {

        $email_safe = mysqli_real_escape_string(
            $conn,
            $email
        );


        $query = mysqli_query(
            $conn,
            "SELECT
                id,
                name,
                email,
                password,
                role,
                status
             FROM users
             WHERE email = '$email_safe'
             LIMIT 1"
        );


        if (!$query) {

            $error = "Database error. Please try again.";

        } elseif (mysqli_num_rows($query) == 0) {

            $error = "Invalid email or password.";

        } else {

            $user = mysqli_fetch_assoc($query);


            // Check account status

            if ((int) $user["status"] !== 1) {

                $error = "Your account is inactive.";

            } elseif (
                password_verify(
                    $password,
                    $user["password"]
                )
            ) {


                // Clear old session values

                session_unset();


                // Create fresh session

                $_SESSION["user_id"] = (int) $user["id"];

                $_SESSION["name"] = $user["name"];

                $_SESSION["role"] = $user["role"];


                // Regenerate session ID

                session_regenerate_id(true);


                // Redirect according to role

                if ($user["role"] == "admin") {

                    header(
                        "Location: ../admin/dashboard.php"
                    );

                    exit();

                } elseif ($user["role"] == "doctor") {

                    header(
                        "Location: ../doctor/dashboard.php"
                    );

                    exit();

                } elseif ($user["role"] == "patient") {

                    header(
                        "Location: ../patient/dashboard.php"
                    );

                    exit();

                } else {

                    session_unset();
                    session_destroy();

                    $error = "Invalid user role.";

                }

            } else {

                $error = "Invalid email or password.";

            }

        }

    }

}

?>

<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Login | ClinicCare</title>

    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css"
    >

    <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
    >

    <link
        rel="stylesheet"
        href="../css/style.css"
    >

</head>


<body>

<div
    style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:var(--cc-bg);
        padding:20px;
    "
>


    <div
        style="
            width:100%;
            max-width:420px;
            background:white;
            border:1px solid var(--cc-border);
            border-radius:14px;
            box-shadow:var(--cc-shadow-md);
            overflow:hidden;
        "
    >


        <!-- Header -->

        <div
            style="
                padding:26px 28px;
                background:var(--cc-navy);
                color:white;
                text-align:center;
            "
        >

            <div
                style="
                    width:48px;
                    height:48px;
                    margin:0 auto 12px;
                    border-radius:11px;
                    background:var(--cc-blue);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:21px;
                "
            >

                <i class="fa-solid fa-plus"></i>

            </div>


            <h1
                style="
                    margin:0;
                    font-size:22px;
                    color:white;
                "
            >
                ClinicCare
            </h1>


            <p
                style="
                    margin:5px 0 0;
                    color:#CBD5E1;
                    font-size:11px;
                "
            >
                Clinic & Appointment Management System
            </p>

        </div>


        <!-- Form -->

        <div style="padding:28px;">


            <div
                style="
                    margin-bottom:22px;
                    text-align:center;
                "
            >

                <h2
                    style="
                        margin:0;
                        color:var(--cc-navy);
                        font-size:19px;
                    "
                >
                    Welcome Back
                </h2>

                <p
                    style="
                        margin:5px 0 0;
                        color:var(--cc-muted);
                        font-size:11px;
                    "
                >
                    Login to your ClinicCare account.
                </p>

            </div>


            <!-- Error -->

            <?php if ($error != "") { ?>

                <div class="cc-alert cc-alert-danger">

                    <div class="cc-alert-icon">

                        <i class="fa-solid fa-exclamation"></i>

                    </div>

                    <span>
                        <?php echo htmlspecialchars($error); ?>
                    </span>

                </div>

            <?php } ?>


            <form
                method="POST"
                action="login.php"
            >


                <!-- Email -->

                <div class="cc-form-group">

                    <label class="cc-form-label">
                        Email
                    </label>


                    <div class="cc-input-wrapper">

                        <i class="fa-regular fa-envelope"></i>

                        <input
                            type="email"
                            name="email"
                            class="cc-input"
                            placeholder="Enter your email"
                            required
                        >

                    </div>

                </div>


                <!-- Password -->

                <div class="cc-form-group">

                    <label class="cc-form-label">
                        Password
                    </label>


                    <div class="cc-input-wrapper">

                        <i class="fa-solid fa-lock"></i>

                        <input
                            type="password"
                            name="password"
                            class="cc-input"
                            placeholder="Enter your password"
                            required
                        >

                    </div>

                </div>


                <!-- Login -->

                <button
                    type="submit"
                    class="cc-btn cc-btn-primary"
                    style="width:100%; height:42px;"
                >

                    <i class="fa-solid fa-right-to-bracket"></i>

                    Login

                </button>

            </form>


            <div
                style="
                    margin-top:18px;
                    text-align:center;
                    color:var(--cc-muted);
                    font-size:11px;
                "
            >

                Don't have an account?

                <a
                    href="register.php"
                    style="
                        color:var(--cc-blue-dark);
                        font-weight:700;
                    "
                >
                    Register here
                </a>

            </div>

        </div>

    </div>

</div>

</body>

</html>