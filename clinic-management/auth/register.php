<?php

session_start();
include("../config/database.php");

$message = "";
$success = "";

if (isset($_POST["register"])) {

    $name = $_POST["name"];
    $email = $_POST["email"];
    $password = $_POST["password"];


    // Check whether email already exists
    $sql = "SELECT id FROM users WHERE email = ?";

    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, "s", $email);
    mysqli_stmt_execute($stmt);

    $result = mysqli_stmt_get_result($stmt);


    if (mysqli_num_rows($result) > 0) {

        $message = "An account with this email already exists.";

    } else {

        // Hash password
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);


        // Insert user
        $sql = "INSERT INTO users
                (name, email, password, role)
                VALUES (?, ?, ?, 'patient')";

        $stmt = mysqli_prepare($conn, $sql);

        mysqli_stmt_bind_param(
            $stmt,
            "sss",
            $name,
            $email,
            $hashed_password
        );

        mysqli_stmt_execute($stmt);


        // Get newly created user ID
        $user_id = mysqli_insert_id($conn);


        // Create patient record
        $sql = "INSERT INTO patients (user_id)
                VALUES (?)";

        $stmt = mysqli_prepare($conn, $sql);

        mysqli_stmt_bind_param($stmt, "i", $user_id);

        mysqli_stmt_execute($stmt);


        $success = "Registration successful! You can now login.";
    }
}

?>

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Register - Clinic Management System</title>

<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">

<link rel="stylesheet" href="../css/style.css">


</head>

<body>

<div class="login-page">    


<div class="login-box">

    <!-- LEFT SIDE -->

    <div class="login-left">

        <div class="brand-icon">
            🏥
        </div>

        <h1>Join Our Clinic</h1>

        <p>
            Create your patient account and manage
            your appointments and prescriptions easily.
        </p>

        <div class="feature-list">

            <div class="feature-item">

                <div class="feature-icon">
                    ✓
                </div>

                Book appointments easily

            </div>

            <div class="feature-item">

                <div class="feature-icon">
                    ✓
                </div>

                View your appointment history

            </div>

            <div class="feature-item">

                <div class="feature-icon">
                    ✓
                </div>

                Access your prescriptions

            </div>

        </div>

    </div>


    <!-- RIGHT SIDE -->

    <div class="login-right">

        <div class="login-form-box">

            <h2>Create Account</h2>

            <p class="login-subtitle">
                Register as a patient to get started.
            </p>


            <?php if ($message != "") { ?>

                <div class="alert alert-danger login-alert">

                    <?php echo $message; ?>

                </div>

            <?php } ?>


            <?php if ($success != "") { ?>

                <div class="alert alert-success login-alert">

                    <?php echo $success; ?>

                </div>

            <?php } ?>


            <form method="POST">

                <div class="form-group">

                    <label class="login-label">
                        Full Name
                    </label>

                    <input
                        type="text"
                        name="name"
                        class="form-control login-input"
                        placeholder="Enter your full name"
                        required
                    >

                </div>


                <div class="form-group">

                    <label class="login-label">
                        Email Address
                    </label>

                    <input
                        type="email"
                        name="email"
                        class="form-control login-input"
                        placeholder="Enter your email"
                        required
                    >

                </div>


                <div class="form-group">

                    <label class="login-label">
                        Password
                    </label>

                    <input
                        type="password"
                        name="password"
                        class="form-control login-input"
                        placeholder="Create a password"
                        required
                    >

                </div>


                <button
                    type="submit"
                    name="register"
                    class="login-btn"
                >
                    Create Account
                </button>

            </form>


            <div class="text-center mt-4">

                <span class="text-muted">
                    Already have an account?
                </span>

                <a
                    href="login.php"
                    class="register-link ml-1"
                >
                    Login
                </a>

            </div>

        </div>

    </div>

</div>


</div>

<script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js"></script>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js"></script>

</body>

</html>
