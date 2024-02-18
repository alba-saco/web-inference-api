import requests
import time
from requests.exceptions import JSONDecodeError
import os
import base64
import filecmp

def upload_file(file_path):
    '''Sends the file to the server, returns the file id'''
    upload_url = 'http://localhost:3000/upload'
    try:
        with open(file_path, 'rb') as file:
            # files = {'file': file}
            files = {'file': (os.path.basename(file_path), file, 'audio/mpeg')}
            response = requests.post(upload_url, files=files)

        response.raise_for_status() 

        if response.ok:
            print('File uploaded successfully.')
            response_data = response.json()
            file_id = response_data.get('fileId')
            file_content_base64 = response_data.get('fileContent')
            file_content = base64.b64decode(file_content_base64)
            # return response.json().get('fileId')
            return file_id, file_content
        else:
            print('Error uploading file to the server:', response.status_code, response.text)
            return None
    except Exception as e:
        print('Error during file upload:', e)
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


def compare_files(original_file, received_file):
    '''Compares the content of two files'''
    if original_file == received_file:
        print('File content matches!')
    else:
        print('File content does not match.')


def download_file(file_id, original_file_path):
    download_url = f'http://localhost:3000/file/{file_id}'
    
    try:
        response = requests.get(download_url)
        response.raise_for_status()

        # Save the downloaded file
        downloaded_file_path = 'downloaded_file.mp3'
        with open(downloaded_file_path, 'wb') as downloaded_file:
            downloaded_file.write(response.content)

        # Compare the downloaded file with the original file
        files_match = filecmp.cmp(original_file_path, downloaded_file_path)

        if files_match:
            print('Downloaded file matches original!')
        else:
            print('Downloaded files does not match.')

    except requests.exceptions.RequestException as e:
        print('Error downloading file:', e)


if __name__ == "__main__":
    file_path = '935_CwS2FtnyZBE.mp3'
    file_id, received_file_content = upload_file(file_path)

    if file_id:
        processed_data = wait_for_processing(file_id)
        if processed_data:
            print('Processed data:', processed_data)
