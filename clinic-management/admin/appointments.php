<?php

session_start();

if (!isset($_SESSION["user_id"]) || $_SESSION["role"] != "admin") {
    header("Location: ../auth/login.php");
    exit();
}

include("../config/database.php");

$admin_name = $_SESSION["name"];


// =====================================================
// FILTERS
// =====================================================

$filter_date = isset($_GET["date"])
    ? mysqli_real_escape_string($conn, $_GET["date"])
    : "";

$filter_status = isset($_GET["status"])
    ? mysqli_real_escape_string($conn, $_GET["status"])
    : "";


// =====================================================
// BUILD QUERY
// =====================================================

$where = "WHERE 1=1";

if ($filter_date != "") {

    $where .=
        " AND appointments.appointment_date = '$filter_date'";
}

if ($filter_status != "") {

    $where .=
        " AND appointments.status = '$filter_status'";
}


// =====================================================
// APPOINTMENTS
// =====================================================

$appointments_query = mysqli_query(
    $conn,
    "SELECT
        appointments.id,
        appointments.token_number,
        appointments.appointment_date,
        appointments.appointment_time,
        appointments.reason,
        appointments.status,
        appointments.queue_status,
        appointments.cancel_reason,

        patient_users.name AS patient_name,

        doctor_users.name AS doctor_name,

        departments.name AS department_name

     FROM appointments

     INNER JOIN patients
        ON appointments.patient_id = patients.id

     INNER JOIN users AS patient_users
        ON patients.user_id = patient_users.id

     INNER JOIN doctors
        ON appointments.doctor_id = doctors.id

     INNER JOIN users AS doctor_users
        ON doctors.user_id = doctor_users.id

     INNER JOIN departments
        ON doctors.department_id = departments.id

     $where

     ORDER BY
        appointments.appointment_date DESC,
        appointments.appointment_time ASC"
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

    <title>Appointments | ClinicCare Admin</title>

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
                <?php
                echo strtoupper(
                    substr($admin_name, 0, 1)
                );
                ?>
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

            <a href="departments.php" class="admin-nav-link">
                <i class="fa-solid fa-building"></i>
                <span>Departments</span>
            </a>

            <a
                href="appointments.php"
                class="admin-nav-link active"
            >
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
                    Admin Portal / Appointments
                </div>

                <h1>Appointments</h1>

                <p>
                    Monitor all patient appointments and queue statuses.
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


            <!-- FILTERS -->

            <section class="admin-card">

                <div class="admin-card-header">

                    <div>

                        <h2>Appointment Records</h2>

                        <p>
                            Filter appointments by date and status.
                        </p>

                    </div>

                </div>


                <form
                    method="GET"
                    action="appointments.php"
                    class="admin-form"
                >

                    <div class="row">

                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>
                                    Appointment Date
                                </label>

                                <input
                                    type="date"
                                    name="date"
                                    value="<?php
                                    echo htmlspecialchars(
                                        $filter_date
                                    );
                                    ?>"
                                >

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div class="admin-form-group">

                                <label>
                                    Status
                                </label>

                                <select name="status">

                                    <option value="">
                                        All Statuses
                                    </option>

                                    <option
                                        value="pending"
                                        <?php
                                        echo $filter_status == "pending"
                                            ? "selected"
                                            : "";
                                        ?>
                                    >
                                        Pending
                                    </option>

                                    <option
                                        value="confirmed"
                                        <?php
                                        echo $filter_status == "confirmed"
                                            ? "selected"
                                            : "";
                                        ?>
                                    >
                                        Confirmed
                                    </option>

                                    <option
                                        value="completed"
                                        <?php
                                        echo $filter_status == "completed"
                                            ? "selected"
                                            : "";
                                        ?>
                                    >
                                        Completed
                                    </option>

                                    <option
                                        value="cancelled"
                                        <?php
                                        echo $filter_status == "cancelled"
                                            ? "selected"
                                            : "";
                                        ?>
                                    >
                                        Cancelled
                                    </option>

                                </select>

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div
                                class="admin-form-group"
                                style="padding-top:27px;"
                            >

                                <button
                                    type="submit"
                                    class="cc-btn cc-btn-primary"
                                >

                                    <i class="fa-solid fa-filter"></i>

                                    Apply Filter

                                </button>


                                <a
                                    href="appointments.php"
                                    class="cc-btn cc-btn-secondary"
                                >

                                    Clear

                                </a>

                            </div>

                        </div>

                    </div>

                </form>


                <!-- TABLE -->

                <div class="admin-table-wrapper">

                    <table class="admin-table">

                        <thead>

                            <tr>

                                <th>Token</th>
                                <th>Patient</th>
                                <th>Doctor</th>
                                <th>Department</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Queue</th>
                                <th>Status</th>

                            </tr>

                        </thead>


                        <tbody>

                        <?php if (
                            mysqli_num_rows($appointments_query) > 0
                        ) { ?>


                            <?php while (
                                $appointment =
                                mysqli_fetch_assoc(
                                    $appointments_query
                                )
                            ) { ?>


                                <tr>


                                    <!-- TOKEN -->

                                    <td>

                                        <span class="admin-token">

                                            #

                                            <?php
                                            echo $appointment["token_number"];
                                            ?>

                                        </span>

                                    </td>


                                    <!-- PATIENT -->

                                    <td>

                                        <div class="admin-person">

                                            <div class="admin-person-avatar">

                                                <?php
                                                echo strtoupper(
                                                    substr(
                                                        $appointment["patient_name"],
                                                        0,
                                                        1
                                                    )
                                                );
                                                ?>

                                            </div>

                                            <div class="admin-person-info">

                                                <strong>

                                                    <?php
                                                    echo htmlspecialchars(
                                                        $appointment["patient_name"]
                                                    );
                                                    ?>

                                                </strong>

                                                <span>
                                                    Patient
                                                </span>

                                            </div>

                                        </div>

                                    </td>


                                    <!-- DOCTOR -->

                                    <td>

                                        Dr.

                                        <?php
                                        echo htmlspecialchars(
                                            $appointment["doctor_name"]
                                        );
                                        ?>

                                    </td>


                                    <!-- DEPARTMENT -->

                                    <td>

                                        <?php
                                        echo htmlspecialchars(
                                            $appointment["department_name"]
                                        );
                                        ?>

                                    </td>


                                    <!-- DATE -->

                                    <td>

                                        <?php
                                        echo date(
                                            "d M Y",
                                            strtotime(
                                                $appointment["appointment_date"]
                                            )
                                        );
                                        ?>

                                    </td>


                                    <!-- TIME -->

                                    <td>

                                        <?php
                                        echo date(
                                            "h:i A",
                                            strtotime(
                                                $appointment["appointment_time"]
                                            )
                                        );
                                        ?>

                                    </td>


                                    <!-- QUEUE -->

                                    <td>

                                        <?php

                                        if (
                                            $appointment["queue_status"]
                                            == "waiting"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-status-waiting
                                                ">
                                                    Waiting
                                                </span>
                                            ';

                                        } elseif (
                                            $appointment["queue_status"]
                                            == "serving"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-status-serving
                                                ">
                                                    Serving
                                                </span>
                                            ';

                                        } elseif (
                                            $appointment["queue_status"]
                                            == "completed"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-status-completed
                                                ">
                                                    Completed
                                                </span>
                                            ';

                                        } else {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-status-skipped
                                                ">
                                                    Skipped
                                                </span>
                                            ';

                                        }

                                        ?>

                                    </td>


                                    <!-- STATUS -->

                                    <td>

                                        <?php

                                        if (
                                            $appointment["status"]
                                            == "pending"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-warning
                                                ">
                                                    Pending
                                                </span>
                                            ';

                                        } elseif (
                                            $appointment["status"]
                                            == "confirmed"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-primary
                                                ">
                                                    Confirmed
                                                </span>
                                            ';

                                        } elseif (
                                            $appointment["status"]
                                            == "completed"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-success
                                                ">
                                                    Completed
                                                </span>
                                            ';

                                        } else {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-danger
                                                ">
                                                    Cancelled
                                                </span>
                                            ';

                                        }

                                        ?>

                                    </td>


                                </tr>


                                <?php if (
                                    $appointment["status"]
                                    == "cancelled"
                                    &&
                                    !empty(
                                        $appointment["cancel_reason"]
                                    )
                                ) { ?>

                                    <tr>

                                        <td colspan="8">

                                            <div class="cc-alert cc-alert-danger">

                                                <div class="cc-alert-icon">
                                                    <i class="fa-solid fa-info"></i>
                                                </div>

                                                <span>

                                                    Cancellation reason:

                                                    <?php
                                                    echo htmlspecialchars(
                                                        $appointment[
                                                            "cancel_reason"
                                                        ]
                                                    );
                                                    ?>

                                                </span>

                                            </div>

                                        </td>

                                    </tr>

                                <?php } ?>


                            <?php } ?>


                        <?php } else { ?>


                            <tr>

                                <td
                                    colspan="8"
                                    style="padding:0;"
                                >

                                    <div class="admin-empty">

                                        <div class="admin-empty-icon">

                                            <i class="fa-regular fa-calendar-xmark"></i>

                                        </div>

                                        <h3>
                                            No appointments found
                                        </h3>

                                        <p>
                                            Try changing the selected filters.
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