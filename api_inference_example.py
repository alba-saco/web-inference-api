import requests
import time
from requests.exceptions import JSONDecodeError

def upload_file(file_path):
    '''Sends the file to the server, returns the file id'''
    upload_url = 'http://localhost:3000/upload'
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(upload_url, files=files)

    if response.ok:
        print('File uploaded successfully.')
        return response.json().get('fileId')
    else:
        print('Error uploading file to the server:', response.status_code, response.text)
        return None


def check_processing_status(file_id):
    '''Checks the status of a file (i.e. whether it is done processing or not, or if there's been an error)'''
    status_url = f'http://localhost:3000/check-processing-status/{file_id}'
    response = requests.get(status_url)
    return response.json().get('status')


def get_processed_data(file_id):
    '''Retrieves the postprocessed output from VGGish as a json'''
    processed_data_url = f'http://localhost:3000/get-processed-data/{file_id}'
    try:
        response = requests.get(processed_data_url)
        response.raise_for_status()
        return response.json()
    except JSONDecodeError:
        print("JSON decoding error. Response may be empty or not in JSON format.")
        return None
    except requests.RequestException as e:
        print(f"Error: {e}")
        return None


def wait_for_processing(file_id):
    '''Polling mechanism that checks every 5 seconds on whether a file has finished processing,
    returns the processed output if it has'''
    while True:
        status = check_processing_status(file_id)
        print(f'Processing status for file {file_id}: {status}')

        if status == 'processed':
            processed_data = get_processed_data(file_id)
            if processed_data:
                print('File processed successfully.')
            else:
                print('Something happened. Check that the audio context has been started on the UI.')
            return processed_data
        elif status == 'error':
            print('Error processing file. Please check server logs.')
            return None
        
        time.sleep(5)


if __name__ == "__main__":
    file_path = 'mal.wav'
    file_id = upload_file(file_path)

    if file_id:
        processed_data = wait_for_processing(file_id)
        if processed_data:
            print('Processed data:', processed_data)
