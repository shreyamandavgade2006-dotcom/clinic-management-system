<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'patient') {
    header('Location: ../auth/login.php');
    exit();
}
include('../config/database.php');
$user_id = (int) $_SESSION['user_id'];
$patient_name = $_SESSION['name'];
$pq = mysqli_query($conn, "SELECT id FROM patients WHERE user_id=$user_id LIMIT 1");
$p = mysqli_fetch_assoc($pq);
if (!$p)
    die('Patient profile not found.');
$patient_id = (int) $p['id'];
$error = '';
$success = '';
if (isset($_POST['book_appointment'])) {
    $doctor_id = (int) $_POST['doctor_id'];
    $date = mysqli_real_escape_string($conn, $_POST['appointment_date']);
    $time = mysqli_real_escape_string($conn, $_POST['appointment_time']);
    $reason = mysqli_real_escape_string($conn, trim($_POST['reason']));
    $leave = mysqli_query($conn, "SELECT id FROM doctor_leaves WHERE doctor_id=$doctor_id AND leave_date='$date' LIMIT 1");
    $dup = mysqli_query($conn, "SELECT id FROM appointments WHERE patient_id=$patient_id AND doctor_id=$doctor_id AND appointment_date='$date' AND appointment_time='$time' AND status!='cancelled' LIMIT 1");
    if (mysqli_num_rows($leave)) {
        $error = 'The selected doctor is unavailable on this date.';
    } elseif (mysqli_num_rows($dup)) {
        $error = 'You already have an appointment with this doctor at the selected time.';
    } elseif ($date < date('Y-m-d')) {
        $error = 'Please select a current or future date.';
    } else {
        $max = mysqli_query($conn, "SELECT MAX(token_number) max_token FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$date'");
        $m = mysqli_fetch_assoc($max);
        $token = $m['max_token'] ? ((int) $m['max_token'] + 1) : 1;
        $insert = mysqli_query($conn, "INSERT INTO appointments(token_number,patient_id,doctor_id,appointment_date,appointment_time,reason,status,queue_status) VALUES($token,$patient_id,$doctor_id,'$date','$time','$reason','pending','waiting')");
        if ($insert) {
            $du = mysqli_query($conn, "SELECT u.name doctor_name,d.department_id FROM doctors d JOIN users u ON d.user_id=u.id WHERE d.id=$doctor_id LIMIT 1");
            $dr = mysqli_fetch_assoc($du);
            $msg = mysqli_real_escape_string($conn, 'Appointment booked with Dr. ' . $dr['doctor_name'] . ' on ' . date('d M Y', strtotime($date)) . '. Your token number is #' . $token . '.');
            mysqli_query($conn, "INSERT INTO notifications(user_id,message,type) VALUES($user_id,'$msg','appointment')");
            $success = 'Appointment booked successfully. Your token is #' . $token . '.';
        } else {
            $error = 'Unable to book the appointment.';
        }
    }
}
$doctors = mysqli_query($conn, "SELECT d.id,d.specialization,d.qualification,d.experience,d.consultation_fee,u.name doctor_name,dep.name department_name FROM doctors d JOIN users u ON d.user_id=u.id JOIN departments dep ON d.department_id=dep.id WHERE u.status=1 ORDER BY u.name ASC");
?><!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Book Appointment | ClinicCare</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/patient.css">
</head>

<body>
    <div class="patient-layout">
        <aside class="patient-sidebar">
            <div class="patient-brand">
                <div class="patient-brand-icon"><i class="fa-solid fa-plus"></i></div>
                <div>
                    <h3>ClinicCare</h3><span>Patient Portal</span>
                </div>
            </div>
            <div class="patient-profile">
                <div class="patient-avatar-small"><?php echo strtoupper(substr($patient_name, 0, 1)); ?></div>
                <div class="patient-profile-info">
                    <strong><?php echo htmlspecialchars($patient_name); ?></strong><span>Patient</span></div>
            </div>
            <nav class="patient-nav">
                <div class="patient-nav-heading">MAIN MENU</div><a href="dashboard.php" class="patient-nav-link"><i
                        class="fa-solid fa-chart-line patient-nav-icon"></i>Dashboard</a><a href="book_appointment.php"
                    class="patient-nav-link active"><i class="fa-solid fa-calendar-plus patient-nav-icon"></i>Book
                    Appointment</a><a href="appointments.php" class="patient-nav-link"><i
                        class="fa-solid fa-calendar-check patient-nav-icon"></i>Appointments</a><a href="queue.php"
                    class="patient-nav-link"><i class="fa-solid fa-users patient-nav-icon"></i>Live Queue</a><a
                    href="prescriptions.php" class="patient-nav-link"><i
                        class="fa-solid fa-prescription-bottle-medical patient-nav-icon"></i>Prescriptions</a><a
                    href="notifications.php" class="patient-nav-link"><i
                        class="fa-solid fa-bell patient-nav-icon"></i>Notifications</a>
            </nav>
            <div class="patient-sidebar-bottom"><a href="../auth/logout.php" class="patient-logout"><i
                        class="fa-solid fa-right-from-bracket"></i>Logout</a></div>
        </aside>
        <main class="patient-main">
            <header class="patient-topbar">
                <div>
                    <h1>Book Appointment</h1>
                    <p>Choose a doctor and schedule your visit.</p>
                </div>
            </header>
            <div class="patient-content">
                <section class="patient-card">
                    <div class="patient-card-header">
                        <div>
                            <h2>Appointment Details</h2>
                            <p>Fill in the details below.</p>
                        </div>
                    </div>
                    <div class="patient-card-body"><?php if ($error) { ?>
                            <div class="cc-alert cc-alert-danger">
                                <div class="cc-alert-icon" style="background:var(--cc-danger);color:#fff"><i
                                        class="fa-solid fa-exclamation"></i></div><?php echo htmlspecialchars($error); ?>
                            </div><?php }
                    if ($success) { ?>
                            <div class="cc-alert cc-alert-success">
                                <div class="cc-alert-icon" style="background:var(--cc-success);color:#fff"><i
                                        class="fa-solid fa-check"></i></div><?php echo htmlspecialchars($success); ?>
                            </div><?php } ?>
                        <form method="POST">
                            <div class="cc-form-group"><label class="cc-form-label">Doctor</label><select
                                    class="cc-select" name="doctor_id" required>
                                    <option value="">Select doctor</option>
                                    <?php while ($d = mysqli_fetch_assoc($doctors)) { ?>
                                        <option value="<?php echo $d['id']; ?>">Dr.
                                            <?php echo htmlspecialchars($d['doctor_name']); ?> —
                                            <?php echo htmlspecialchars($d['department_name']); ?> —
                                            <?php echo htmlspecialchars($d['specialization']); ?></option><?php } ?>
                                </select></div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Date</label><input
                                            class="cc-input" type="date" name="appointment_date"
                                            min="<?php echo date('Y-m-d'); ?>" required></div>
                                </div>
                                <div class="col-md-6">
                                    <div class="cc-form-group"><label class="cc-form-label">Time</label><input
                                            class="cc-input" type="time" name="appointment_time" required></div>
                                </div>
                            </div>
                            <div class="cc-form-group"><label class="cc-form-label">Reason</label><textarea
                                    class="cc-textarea" name="reason"
                                    placeholder="Describe your reason for visit"></textarea></div><button
                                name="book_appointment" class="patient-primary-btn"><i
                                    class="fa-solid fa-calendar-plus"></i>Book Appointment</button>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    </div>
</body>

</html>