<?php

session_start();

if (!isset($_SESSION["user_id"]) || $_SESSION["role"] != "admin") {
    header("Location: ../auth/login.php");
    exit();
}

include("../config/database.php");

$admin_name = $_SESSION["name"];


// =====================================================
// ADD DEPARTMENT
// =====================================================

if (isset($_POST["add_department"])) {

    $name = mysqli_real_escape_string(
        $conn,
        trim($_POST["name"])
    );

    $description = mysqli_real_escape_string(
        $conn,
        trim($_POST["description"])
    );


    if ($name == "") {

        $_SESSION["department_message"] =
            "Department name is required.";

        $_SESSION["department_message_type"] =
            "error";

    } else {

        $check = mysqli_query(
            $conn,
            "SELECT id
             FROM departments
             WHERE name = '$name'
             LIMIT 1"
        );


        if (mysqli_num_rows($check) > 0) {

            $_SESSION["department_message"] =
                "Department already exists.";

            $_SESSION["department_message_type"] =
                "error";

        } else {

            $insert = mysqli_query(
                $conn,
                "INSERT INTO departments
                    (name, description)
                 VALUES
                    ('$name', '$description')"
            );


            if ($insert) {

                $_SESSION["department_message"] =
                    "Department added successfully.";

                $_SESSION["department_message_type"] =
                    "success";

            } else {

                $_SESSION["department_message"] =
                    "Unable to add department.";

                $_SESSION["department_message_type"] =
                    "error";
            }

        }

    }


    header("Location: departments.php");
    exit();
}


// =====================================================
// DELETE DEPARTMENT
// =====================================================

if (isset($_POST["delete_department"])) {

    $department_id =
        (int) $_POST["department_id"];


    // Check whether doctors use department

    $doctor_check = mysqli_query(
        $conn,
        "SELECT COUNT(*) AS total
         FROM doctors
         WHERE department_id = $department_id"
    );

    $doctor_count =
        mysqli_fetch_assoc(
            $doctor_check
        )["total"];


    if ($doctor_count > 0) {

        $_SESSION["department_message"] =
            "This department cannot be deleted because doctors are assigned to it.";

        $_SESSION["department_message_type"] =
            "error";

    } else {

        $delete = mysqli_query(
            $conn,
            "DELETE FROM departments
             WHERE id = $department_id"
        );


        if ($delete) {

            $_SESSION["department_message"] =
                "Department deleted successfully.";

            $_SESSION["department_message_type"] =
                "success";

        } else {

            $_SESSION["department_message"] =
                "Unable to delete department.";

            $_SESSION["department_message_type"] =
                "error";
        }

    }


    header("Location: departments.php");
    exit();
}


// =====================================================
// DEPARTMENTS
// =====================================================

$departments_query = mysqli_query(
    $conn,
    "SELECT
        departments.id,
        departments.name,
        departments.description,
        COUNT(doctors.id) AS doctor_count

     FROM departments

     LEFT JOIN doctors
        ON departments.id = doctors.department_id

     GROUP BY
        departments.id,
        departments.name,
        departments.description

     ORDER BY departments.name ASC"
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

    <title>Departments | ClinicCare Admin</title>

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

            <a href="doctors.php" class="admin-nav-link">
                <i class="fa-solid fa-user-doctor"></i>
                <span>Doctors</span>
            </a>

            <a href="patients.php" class="admin-nav-link">
                <i class="fa-solid fa-users"></i>
                <span>Patients</span>
            </a>

            <a
                href="departments.php"
                class="admin-nav-link active"
            >
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
                    Admin Portal / Departments
                </div>

                <h1>Departments</h1>

                <p>
                    Manage clinic departments and specialties.
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


            <?php if (isset($_SESSION["department_message"])) { ?>

                <div
                    class="admin-alert
                    <?php
                    echo $_SESSION["department_message_type"] == "success"
                        ? "success"
                        : "error";
                    ?>"
                >

                    <div class="admin-alert-icon">

                        <?php if (
                            $_SESSION["department_message_type"]
                            == "success"
                        ) { ?>

                            <i class="fa-solid fa-check"></i>

                        <?php } else { ?>

                            <i class="fa-solid fa-triangle-exclamation"></i>

                        <?php } ?>

                    </div>


                    <span>

                        <?php
                        echo htmlspecialchars(
                            $_SESSION["department_message"]
                        );

                        unset($_SESSION["department_message"]);
                        unset($_SESSION["department_message_type"]);
                        ?>

                    </span>

                </div>

            <?php } ?>


            <!-- ADD -->

            <section class="admin-card">

                <div class="admin-card-header">

                    <div>

                        <h2>Add Department</h2>

                        <p>
                            Create a new clinic department.
                        </p>

                    </div>


                    <div class="admin-stat-icon purple">

                        <i class="fa-solid fa-building-circle-plus"></i>

                    </div>

                </div>


                <form
                    method="POST"
                    action="departments.php"
                    class="admin-form"
                >

                    <div class="row">

                        <div class="col-md-5">

                            <div class="admin-form-group">

                                <label>
                                    Department Name
                                </label>

                                <input
                                    type="text"
                                    name="name"
                                    required
                                >

                            </div>

                        </div>


                        <div class="col-md-7">

                            <div class="admin-form-group">

                                <label>
                                    Description
                                </label>

                                <input
                                    type="text"
                                    name="description"
                                    placeholder="Short department description"
                                >

                            </div>

                        </div>

                    </div>


                    <button
                        type="submit"
                        name="add_department"
                        class="cc-btn cc-btn-primary"
                    >

                        <i class="fa-solid fa-plus"></i>

                        Add Department

                    </button>

                </form>

            </section>


            <!-- LIST -->

            <section class="admin-card">

                <div class="admin-card-header">

                    <div>

                        <h2>Department List</h2>

                        <p>
                            Available clinic departments.
                        </p>

                    </div>

                </div>


                <div class="admin-table-wrapper">

                    <table class="admin-table">

                        <thead>

                            <tr>

                                <th>Department</th>
                                <th>Description</th>
                                <th>Doctors</th>
                                <th>Action</th>

                            </tr>

                        </thead>


                        <tbody>

                        <?php if (mysqli_num_rows($departments_query) > 0) { ?>

                            <?php while ($department = mysqli_fetch_assoc($departments_query)) { ?>

                                <tr>

                                    <td>

                                        <div class="admin-person">

                                            <div class="admin-person-avatar">

                                                <i class="fa-solid fa-building"></i>

                                            </div>

                                            <div class="admin-person-info">

                                                <strong>
                                                    <?php
                                                    echo htmlspecialchars(
                                                        $department["name"]
                                                    );
                                                    ?>
                                                </strong>

                                                <span>
                                                    Department
                                                </span>

                                            </div>

                                        </div>

                                    </td>


                                    <td>

                                        <?php
                                        echo !empty(
                                            $department["description"]
                                        )
                                            ? htmlspecialchars(
                                                $department["description"]
                                            )
                                            : "No description";
                                        ?>

                                    </td>


                                    <td>

                                        <span class="cc-badge cc-badge-primary">

                                            <?php
                                            echo $department["doctor_count"];
                                            ?>

                                            Doctors

                                        </span>

                                    </td>


                                    <td>

                                        <?php if (
                                            $department["doctor_count"] == 0
                                        ) { ?>

                                            <form
                                                method="POST"
                                                style="display:inline;"
                                                onsubmit="
                                                    return confirm(
                                                        'Delete this department?'
                                                    );
                                                "
                                            >

                                                <input
                                                    type="hidden"
                                                    name="department_id"
                                                    value="<?php
                                                    echo $department["id"];
                                                    ?>"
                                                >

                                                <button
                                                    type="submit"
                                                    name="delete_department"
                                                    class="admin-action-btn danger"
                                                >

                                                    <i class="fa-solid fa-trash"></i>

                                                    Delete

                                                </button>

                                            </form>

                                        <?php } else { ?>

                                            <span class="cc-badge cc-badge-neutral">
                                                In Use
                                            </span>

                                        <?php } ?>

                                    </td>

                                </tr>

                            <?php } ?>

                        <?php } else { ?>

                            <tr>

                                <td
                                    colspan="4"
                                    style="padding:0;"
                                >

                                    <div class="admin-empty">

                                        <div class="admin-empty-icon">
                                            <i class="fa-solid fa-building"></i>
                                        </div>

                                        <h3>
                                            No departments found
                                        </h3>

                                        <p>
                                            Add your first department above.
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