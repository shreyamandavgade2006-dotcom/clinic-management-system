<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'doctor') {
    header('Location: ../auth/login.php');
    exit();
}
include('../config/database.php');
$user_id = (int) $_SESSION['user_id'];
$doctor_name = $_SESSION['name'];
$appointment_id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$dq = mysqli_query($conn, "SELECT id FROM doctors WHERE user_id=$user_id LIMIT 1");
$doc = mysqli_fetch_assoc($dq);
if (!$doc)
    die('Doctor profile not found.');
$doctor_id = (int) $doc['id'];
$q = mysqli_query($conn, "SELECT a.id,a.patient_id,u.name patient_name FROM appointments a JOIN patients p ON a.patient_id=p.id JOIN users u ON p.user_id=u.id WHERE a.id=$appointment_id AND a.doctor_id=$doctor_id LIMIT 1");
$appointment = mysqli_fetch_assoc($q);
if (!$appointment)
    die('Appointment not found.');
$patient_id = (int) $appointment['patient_id'];
$exists = mysqli_query($conn, "SELECT id FROM prescriptions WHERE appointment_id=$appointment_id LIMIT 1");
if (mysqli_num_rows($exists) > 0) {
    $existing = mysqli_fetch_assoc($exists);
    header('Location: ../patient/print_prescription.php?id=' . (int) $existing['id']);
    exit();
}
if (isset($_POST['create_prescription'])) {
    $diagnosis = mysqli_real_escape_string($conn, trim($_POST['diagnosis']));
    $notes = mysqli_real_escape_string($conn, trim($_POST['notes']));
    $medicine = mysqli_real_escape_string($conn, trim($_POST['medicine_name']));
    $dosage = mysqli_real_escape_string($conn, trim($_POST['dosage']));
    $duration = mysqli_real_escape_string($conn, trim($_POST['duration']));
    $instructions = mysqli_real_escape_string($conn, trim($_POST['instructions']));
    mysqli_begin_transaction($conn);
    try {
        mysqli_query($conn, "INSERT INTO prescriptions(appointment_id,doctor_id,patient_id,diagnosis,notes) VALUES($appointment_id,$doctor_id,$patient_id,'$diagnosis','$notes')");
        $pid = mysqli_insert_id($conn);
        mysqli_query($conn, "INSERT INTO prescription_items(prescription_id,medicine_name,dosage,duration,instructions) VALUES($pid,'$medicine','$dosage','$duration','$instructions')");
        mysqli_query($conn, "UPDATE appointments SET status='completed',queue_status='completed' WHERE id=$appointment_id AND doctor_id=$doctor_id");
        $msg = mysqli_real_escape_string($conn, 'Your prescription from Dr. ' . $doctor_name . ' is now available.');
        mysqli_query($conn, "INSERT INTO notifications(user_id,message,type) SELECT user_id,'$msg','appointment' FROM patients WHERE id=$patient_id");
        mysqli_commit($conn);
        header('Location: ../patient/print_prescription.php?id=' . $pid);
        exit();
    } catch (Exception $e) {
        mysqli_rollback($conn);
        $error = 'Unable to create prescription.';
    }
}
?><!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Create Prescription | ClinicCare</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/doctor.css">
</head>

<body>
    <div class="doctor-page">
        <aside class="doctor-sidebar">
            <div class="doctor-brand">
                <div class="doctor-brand-icon"><i class="fa-solid fa-plus"></i></div>
                <div>
                    <h4>ClinicCare</h4><span>Doctor Portal</span>
                </div>
            </div>
            <div class="sidebar-doctor">
                <div class="doctor-avatar"><?php echo strtoupper(substr($doctor_name, 0, 1)); ?></div>
                <div class="doctor-info"><strong>Dr.
                        <?php echo htmlspecialchars($doctor_name); ?></strong><span>Doctor</span></div>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-heading">MAIN MENU</div><a href="dashboard.php" class="nav-item"><i
                        class="fa-solid fa-chart-line"></i><span>Dashboard</span></a><a href="appointments.php"
                    class="nav-item active"><i class="fa-solid fa-calendar-check"></i><span>Appointments</span></a><a
                    href="leave.php" class="nav-item"><i class="fa-solid fa-calendar-xmark"></i><span>Manage
                        Leave</span></a>
            </nav>
            <div class="sidebar-bottom"><a href="../auth/logout.php" class="logout-link"><i
                        class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a></div>
        </aside>
        <main class="doctor-main">
            <header class="doctor-topbar">
                <div>
                    <div class="doctor-breadcrumb">Doctor Portal / Prescription</div>
                    <h1>Create Prescription</h1>
                    <p>Record diagnosis, medicine and instructions for the patient.</p>
                </div>
            </header>
            <div class="doctor-content">
                <section class="cc-card">
                    <div class="cc-card-header">
                        <div>
                            <h2><?php echo htmlspecialchars($appointment['patient_name']); ?></h2>
                            <p>Appointment #<?php echo $appointment_id; ?></p>
                        </div>
                    </div>
                    <div class="cc-card-body"><?php if (isset($error)) { ?>
                            <div class="cc-alert cc-alert-danger">
                                <div class="cc-alert-icon" style="background:var(--cc-danger);color:#fff"><i
                                        class="fa-solid fa-exclamation"></i></div><span><?php echo $error; ?></span>
                            </div><?php } ?>
                        <form method="POST">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Diagnosis</label><textarea
                                            name="diagnosis" class="cc-textarea" required></textarea></div>
                                </div>
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Notes</label><textarea
                                            name="notes" class="cc-textarea"></textarea></div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Medicine Name</label><input
                                            class="cc-input" name="medicine_name" required></div>
                                </div>
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Dosage</label><input
                                            class="cc-input" name="dosage"></div>
                                </div>
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Duration</label><input
                                            class="cc-input" name="duration"></div>
                                </div>
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Instructions</label><input
                                            class="cc-input" name="instructions"></div>
                                </div>
                            </div><button name="create_prescription" class="cc-btn cc-btn-primary"><i
                                    class="fa-solid fa-prescription-bottle-medical"></i> Create Prescription</button>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    </div>
</body>

</html>