# Delete Jules Sessions

Deletes a list of Jules sessions by ID using the Jules API.

## Instructions

You will receive a JSON array of session IDs to delete. For each ID, make a DELETE request to:
`https://jules.googleapis.com/v1alpha/sessions/{id}`

Use the `conn_eefcc2t97c0bfqx78k4p__remote_http_call` tool for each request.

Process all IDs and report how many were successfully deleted vs failed.

Report your results as: "Deleted X/Y sessions successfully."
