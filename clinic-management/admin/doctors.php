<?php

session_start();

if (!isset($_SESSION["user_id"]) || $_SESSION["role"] != "admin") {
    header("Location: ../auth/login.php");
    exit();
}

include("../config/database.php");

$admin_name = $_SESSION["name"];


// =====================================================
// ADD DOCTOR
// =====================================================

if (isset($_POST["add_doctor"])) {

    $name = mysqli_real_escape_string(
        $conn,
        trim($_POST["name"])
    );

    $email = mysqli_real_escape_string(
        $conn,
        trim($_POST["email"])
    );

    $password = $_POST["password"];

    $department_id = (int) $_POST["department_id"];

    $specialization = mysqli_real_escape_string(
        $conn,
        trim($_POST["specialization"])
    );

    $qualification = mysqli_real_escape_string(
        $conn,
        trim($_POST["qualification"])
    );

    $experience = (int) $_POST["experience"];

    $consultation_fee = (float) $_POST["consultation_fee"];

    $avg_consultation_minutes =
        (int) $_POST["avg_consultation_minutes"];

    $phone = mysqli_real_escape_string(
        $conn,
        trim($_POST["phone"])
    );


    // Check duplicate email

    $check = mysqli_query(
        $conn,
        "SELECT id
         FROM users
         WHERE email = '$email'
         LIMIT 1"
    );


    if (mysqli_num_rows($check) > 0) {

        $_SESSION["admin_message"] =
            "A user with this email already exists.";

        $_SESSION["admin_message_type"] = "error";

    } else {

        mysqli_begin_transaction($conn);

        try {

            $hashed_password =
                password_hash(
                    $password,
                    PASSWORD_DEFAULT
                );


            // Insert user

            $user_insert = mysqli_query(
                $conn,
                "INSERT INTO users
                    (
                        name,
                        email,
                        password,
                        role
                    )
                 VALUES
                    (
                        '$name',
                        '$email',
                        '$hashed_password',
                        'doctor'
                    )"
            );


            if (!$user_insert) {
                throw new Exception("User insertion failed.");
            }


            $new_user_id =
                mysqli_insert_id($conn);


            // Insert doctor

            $doctor_insert = mysqli_query(
                $conn,
                "INSERT INTO doctors
                    (
                        user_id,
                        department_id,
                        specialization,
                        qualification,
                        experience,
                        consultation_fee,
                        avg_consultation_minutes,
                        phone
                    )
                 VALUES
                    (
                        $new_user_id,
                        $department_id,
                        '$specialization',
                        '$qualification',
                        $experience,
                        $consultation_fee,
                        $avg_consultation_minutes,
                        '$phone'
                    )"
            );


            if (!$doctor_insert) {
                throw new Exception("Doctor insertion failed.");
            }


            mysqli_commit($conn);


            $_SESSION["admin_message"] =
                "Doctor added successfully.";

            $_SESSION["admin_message_type"] =
                "success";

        } catch (Exception $e) {

            mysqli_rollback($conn);

            $_SESSION["admin_message"] =
                "Unable to add doctor.";

            $_SESSION["admin_message_type"] =
                "error";
        }

    }


    header("Location: doctors.php");
    exit();
}


// =====================================================
// DEPARTMENT LIST
// =====================================================

$departments_query = mysqli_query(
    $conn,
    "SELECT id, name
     FROM departments
     ORDER BY name ASC"
);


// =====================================================
// DOCTOR LIST
// =====================================================

$doctors_query = mysqli_query(
    $conn,
    "SELECT
        doctors.id,
        doctors.specialization,
        doctors.qualification,
        doctors.experience,
        doctors.consultation_fee,
        doctors.avg_consultation_minutes,
        doctors.phone,

        users.name,
        users.email,
        users.status,

        departments.name AS department_name

     FROM doctors

     INNER JOIN users
        ON doctors.user_id = users.id

     INNER JOIN departments
        ON doctors.department_id = departments.id

     ORDER BY users.name ASC"
);

?>

<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Doctors | ClinicCare Admin</title>

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

    <link
        rel="stylesheet"
        href="../css/admin.css"
    >

</head>

<body>

<div class="admin-layout">


    <!-- SIDEBAR -->

    <aside class="admin-sidebar">

        <div class="admin-brand">

            <div class="admin-brand-icon">
                <i class="fa-solid fa-plus"></i>
            </div>

            <div>
                <h4>ClinicCare</h4>
                <span>Admin Portal</span>
            </div>

        </div>


        <div class="admin-profile">

            <div class="admin-avatar">
                <?php echo strtoupper(substr($admin_name, 0, 1)); ?>
            </div>

            <div class="admin-profile-info">

                <strong>
                    <?php echo htmlspecialchars($admin_name); ?>
                </strong>

                <span>Administrator</span>

            </div>

        </div>


        <nav class="admin-nav">

            <div class="admin-nav-heading">
                MAIN MENU
            </div>

            <a href="dashboard.php" class="admin-nav-link">
                <i class="fa-solid fa-chart-line"></i>
                <span>Dashboard</span>
            </a>

            <a href="doctors.php" class="admin-nav-link active">
                <i class="fa-solid fa-user-doctor"></i>
                <span>Doctors</span>
            </a>

            <a href="patients.php" class="admin-nav-link">
                <i class="fa-solid fa-users"></i>
                <span>Patients</span>
            </a>

            <a href="departments.php" class="admin-nav-link">
                <i class="fa-solid fa-building"></i>
                <span>Departments</span>
            </a>

            <a href="appointments.php" class="admin-nav-link">
                <i class="fa-solid fa-calendar-check"></i>
                <span>Appointments</span>
            </a>

        </nav>


        <div class="admin-sidebar-bottom">

            <a
                href="../auth/logout.php"
                class="admin-logout"
            >
                <i class="fa-solid fa-right-from-bracket"></i>
                <span>Logout</span>
            </a>

        </div>

    </aside>


    <!-- MAIN -->

    <main class="admin-main">

        <header class="admin-topbar">

            <div class="admin-topbar-left">

                <div class="admin-breadcrumb">
                    Admin Portal / Doctors
                </div>

                <h1>Doctors</h1>

                <p>
                    Manage doctor profiles and consultation details.
                </p>

            </div>


            <div class="admin-topbar-right">

                <div class="admin-date-box">

                    <div class="admin-date-icon">
                        <i class="fa-regular fa-calendar"></i>
                    </div>

                    <div>

                        <span>Today</span>

                        <strong>
                            <?php echo date("d M Y"); ?>
                        </strong>

                    </div>

                </div>

            </div>

        </header>


        <div class="admin-content">


            <!-- MESSAGE -->

            <?php if (isset($_SESSION["admin_message"])) { ?>

                <div
                    class="admin-alert
                    <?php
                    echo $_SESSION["admin_message_type"] == "success"
                        ? "success"
                        : "error";
                    ?>"
                >

                    <div class="admin-alert-icon">

                        <?php if (
                            $_SESSION["admin_message_type"] == "success"
                        ) { ?>

                            <i class="fa-solid fa-check"></i>

                        <?php } else { ?>

                            <i class="fa-solid fa-triangle-exclamation"></i>

                        <?php } ?>

                    </div>

                    <span>

                        <?php
                        echo htmlspecialchars(
                            $_SESSION["admin_message"]
                        );

                        unset($_SESSION["admin_message"]);
                        unset($_SESSION["admin_message_type"]);
                        ?>

                    </span>

                </div>

            <?php } ?>


            <!-- ADD DOCTOR -->

            <section class="admin-card">

                <div class="admin-card-header">

                    <div>

                        <h2>Add Doctor</h2>

                        <p>
                            Create a doctor account and profile.
                        </p>

                    </div>

                    <div class="admin-stat-icon blue">
                        <i class="fa-solid fa-user-plus"></i>
                    </div>

                </div>


                <form
                    method="POST"
                    action="doctors.php"
                    class="admin-form"
                >

                    <div class="row">

                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>Name</label>

                                <input
                                    type="text"
                                    name="name"
                                    required
                                >

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>Email</label>

                                <input
                                    type="email"
                                    name="email"
                                    required
                                >

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>Password</label>

                                <input
                                    type="password"
                                    name="password"
                                    required
                                >

                            </div>

                        </div>

                    </div>


                    <div class="row">

                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>Department</label>

                                <select
                                    name="department_id"
                                    required
                                >

                                    <option value="">
                                        Select department
                                    </option>

                                    <?php while (
                                        $department =
                                        mysqli_fetch_assoc(
                                            $departments_query
                                        )
                                    ) { ?>

                                        <option
                                            value="<?php echo $department["id"]; ?>"
                                        >
                                            <?php
                                            echo htmlspecialchars(
                                                $department["name"]
                                            );
                                            ?>
                                        </option>

                                    <?php } ?>

                                </select>

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>Specialization</label>

                                <input
                                    type="text"
                                    name="specialization"
                                    required
                                >

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>Qualification</label>

                                <input
                                    type="text"
                                    name="qualification"
                                >

                            </div>

                        </div>

                    </div>


                    <div class="row">

                        <div class="col-md-3">

                            <div class="admin-form-group">

                                <label>Experience (Years)</label>

                                <input
                                    type="number"
                                    name="experience"
                                    min="0"
                                    value="0"
                                >

                            </div>

                        </div>


                        <div class="col-md-3">

                            <div class="admin-form-group">

                                <label>Consultation Fee</label>

                                <input
                                    type="number"
                                    step="0.01"
                                    name="consultation_fee"
                                    min="0"
                                    value="0"
                                >

                            </div>

                        </div>


                        <div class="col-md-3">

                            <div class="admin-form-group">

                                <label>Avg. Consultation (Min)</label>

                                <input
                                    type="number"
                                    name="avg_consultation_minutes"
                                    min="1"
                                    value="10"
                                    required
                                >

                            </div>

                        </div>


                        <div class="col-md-3">

                            <div class="admin-form-group">

                                <label>Phone</label>

                                <input
                                    type="text"
                                    name="phone"
                                >

                            </div>

                        </div>

                    </div>


                    <button
                        type="submit"
                        name="add_doctor"
                        class="cc-btn cc-btn-primary"
                    >

                        <i class="fa-solid fa-user-plus"></i>

                        Add Doctor

                    </button>

                </form>

            </section>


            <!-- DOCTOR LIST -->

            <section class="admin-card">

                <div class="admin-card-header">

                    <div>

                        <h2>Doctor List</h2>

                        <p>
                            Registered doctors in the clinic.
                        </p>

                    </div>

                </div>


                <div class="admin-table-wrapper">

                    <table class="admin-table">

                        <thead>

                            <tr>

                                <th>Doctor</th>
                                <th>Department</th>
                                <th>Specialization</th>
                                <th>Experience</th>
                                <th>Fee</th>
                                <th>Consultation</th>
                                <th>Status</th>

                            </tr>

                        </thead>


                        <tbody>

                        <?php if (mysqli_num_rows($doctors_query) > 0) { ?>

                            <?php while ($doctor = mysqli_fetch_assoc($doctors_query)) { ?>

                                <tr>

                                    <td>

                                        <div class="admin-person">

                                            <div class="admin-person-avatar">
                                                <?php
                                                echo strtoupper(
                                                    substr(
                                                        $doctor["name"],
                                                        0,
                                                        1
                                                    )
                                                );
                                                ?>
                                            </div>

                                            <div class="admin-person-info">

                                                <strong>
                                                    Dr.
                                                    <?php
                                                    echo htmlspecialchars(
                                                        $doctor["name"]
                                                    );
                                                    ?>
                                                </strong>

                                                <span>
                                                    <?php
                                                    echo htmlspecialchars(
                                                        $doctor["email"]
                                                    );
                                                    ?>
                                                </span>

                                            </div>

                                        </div>

                                    </td>


                                    <td>
                                        <?php
                                        echo htmlspecialchars(
                                            $doctor["department_name"]
                                        );
                                        ?>
                                    </td>


                                    <td>
                                        <?php
                                        echo htmlspecialchars(
                                            $doctor["specialization"]
                                        );
                                        ?>
                                    </td>


                                    <td>
                                        <?php
                                        echo $doctor["experience"];
                                        ?> years
                                    </td>


                                    <td>
                                        ₹<?php
                                        echo number_format(
                                            $doctor["consultation_fee"],
                                            2
                                        );
                                        ?>
                                    </td>


                                    <td>
                                        <?php
                                        echo $doctor[
                                            "avg_consultation_minutes"
                                        ];
                                        ?>
                                        min
                                    </td>


                                    <td>

                                        <?php if ($doctor["status"] == 1) { ?>

                                            <span class="cc-badge cc-badge-success">
                                                Active
                                            </span>

                                        <?php } else { ?>

                                            <span class="cc-badge cc-badge-danger">
                                                Inactive
                                            </span>

                                        <?php } ?>

                                    </td>

                                </tr>

                            <?php } ?>

                        <?php } else { ?>

                            <tr>

                                <td
                                    colspan="7"
                                    style="padding:0;"
                                >

                                    <div class="admin-empty">

                                        <div class="admin-empty-icon">
                                            <i class="fa-solid fa-user-doctor"></i>
                                        </div>

                                        <h3>
                                            No doctors found
                                        </h3>

                                        <p>
                                            Add a doctor using the form above.
                                        </p>

                                    </div>

                                </td>

                            </tr>

                        <?php } ?>

                        </tbody>

                    </table>

                </div>

            </section>

        </div>

    </main>

</div>

</body>
</html>