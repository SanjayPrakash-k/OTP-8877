/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
/*************************************************************************************
 ***********
 *
 *
 * ${OTP-8877} : ${External Custom Record form and actions}
 *
 *
 **************************************************************************************
 ********
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 26-May-2025
 *
 * Description : This script is for creating custom record externally without having access to NetSuite. Fetch the details
 * through the form created using Suitelet and check the email already exist in the customer record. If the record 
 * do exist, link the record to the custom record. Lastly send emial to NetSuite admin and if salesrep available for the
 * linked customer, a notification mail will send to salesrep also.
 *
 *
 * REVISION HISTORY
 *
 * @version 1.0  :  26-May-2025:  The initial build was created by JJ0404
 *
 *
 *
 *************************************************************************************
 **********/
define(['N/email', 'N/log', 'N/record', 'N/search', 'N/ui/serverWidget'],
    /**
 * @param{email} email
 * @param{log} log
 * @param{record} record
 * @param{search} search
 * @param{serverWidget} serverWidget
 */
    (email, log, record, search, serverWidget) => {
        /**
         * Defines the Suitelet script trigger point
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            if(scriptContext.request.method === 'GET'){
                createForm(scriptContext);
            } else {
                processEmailRequest(scriptContext);
            } 
        }

        return {onRequest}

        /**
        * Function to create form
        * @param scriptContext
        */
        function createForm(scriptContext){
            try{
                let form = serverWidget.createForm({
                    title: 'Customer Communication Form'
                });

                form.addField({
                    id: 'custpage_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Name'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_email',
                    type: serverWidget.FieldType.EMAIL,
                    label: 'Email'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_subject',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Subject'
                });

                form.addField({
                    id: 'custpage_message',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Message'
                });

                form.addSubmitButton({
                    label: 'Submit'
                });

                scriptContext.response.writePage({
                    pageObject: form
                });

            } catch(error) {
                log.error('Unexpected error occured while creating form', error.toString());
            }
        }

        /**
        * Function to fetch and process email entered in the form
        * @param {void}
        */
        function processEmailRequest(scriptContext) {
            try{
                let customerEmail = scriptContext.request.parameters.custpage_email || 'empty';
                searchAndCheckCustomerEmail(scriptContext, customerEmail);
            } catch(error) {
                log.error('Unexpected error occured when processing email', error.message);
            }
        }

        /**
        * Function to search and check the email of the customer exist or not and create record accordingly
        * @param {string} customerEmail: Email of customer if they already exist in the customer record
        */
        function searchAndCheckCustomerEmail(scriptContext, customerEmail){
            try{
                let customerSearch = search.create({
                    type: search.Type.CUSTOMER,
                    title: 'Existing Customers and Email JJ',
                    id: 'customsearch_jj_existing_customer_email',

                    filters: [
                        ["email", "is", customerEmail]
                    ],

                    columns: [
                        {name: "internalid"},
                        {name: "entityid"},
                        {name: "email"},
                        {name: "internalid", join: 'salesRep'}
                    ]
                });
                let customerSearchResult = customerSearch.run().getRange({ start: 0, end: 10 });

                let customRecordSearch = search.create({
                    type: 'customrecord_jj_external_customer_cmtn',
                    title: 'External Customer Communication Search JJ',
                    id: 'customsearch_jj_external_customer_search',

                    filters:
                    [
                        ["custrecord_jj_email", "is", customerEmail]
                    ],

                    columns:
                    [
                        {name: 'internalid'}
                    ]
                });
                let customSearchResult = customRecordSearch.run().getRange({ start: 0, end: 10});
                
                if(customSearchResult.length === 0){
                    if(customerSearchResult.length === 0){
                        createRecordAndSendEmail(scriptContext, '', customerEmail, '', '');
                    } else {
                        customerSearchResult.forEach(function(result){
                            let internalId = result.getValue('internalid');
                            let customerEmail = result.getValue('email');
                            let customerName = result.getValue('entityid');
                            let salesRep = result.getValue({name: "internalid", join: 'salesRep'});

                            createRecordAndSendEmail(scriptContext, internalId, customerEmail, customerName, salesRep);
                        });
                    }
                } else {
                    let alertForm = serverWidget.createForm({ title: 'Go Back'});

                    alertForm.addField({
                        id: 'custpage_alert_inlinehtml',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'Alert'
                    }).defaultValue = `
                        <script>
                            alert("Record Already Exist. Try Again After Changing Email");
                        </script>
                    `
                    scriptContext.response.writePage({pageObject: alertForm});
                }
                
            } catch(error) {
                log.error('Unexpected Error Occured While Checking Email', error.toString());
            }
        }

        /**
        * Function to create custom record
        * @param {integer} internalId: Internal id of the customer if exist or null
        * @param {string} customerEmail: Email of the customer
        * @param {integer} salesRep: Internal ID of the sales rep if exist or null
        */
        function createRecordAndSendEmail(scriptContext, internalId, customerEmail, salesRep) {
            try{
                let name = scriptContext.request.parameters.custpage_name;
                let subject = scriptContext.request.parameters.custpage_subject;
                let message = scriptContext.request.parameters.custpage_message;
                
                let externalCustomerRecord = record.create({
                    type: 'customrecord_jj_external_customer_cmtn',
                    isDynamic: true
                });

                // let customerUrl;
                // let urlToExistingRecord;
                // if(internalId !== ''){
                //     customerUrl = url.resolveRecord({
                //         recordType: 'customer',
                //         recordId: internalId,
                //         isEditMode: false
                //     });
                //     urlToExistingRecord = 'https://td2994206.app.netsuite.com/' + customerUrl;
                //     log.debug('Url', urlToExistingRecord);
                // }

                externalCustomerRecord.setValue({
                    fieldId: 'name',
                    value: name,
                    ignoreFieldChange: true
                });

                externalCustomerRecord.setValue({
                    fieldId: 'custrecord_jj_customer_reference',
                    value: internalId || '',
                    ignoreFieldChange: true
                });

                externalCustomerRecord.setValue({
                    fieldId: 'custrecord_jj_email',
                    value: customerEmail,
                    ignoreFieldChange: true
                });

                externalCustomerRecord.setValue({
                    fieldId: 'custrecord_jj_subject_',
                    value: subject,
                    ignoreFieldChange: true
                });

                externalCustomerRecord.setValue({
                    fieldId: 'custrecord_jj_message_',
                    value: message,
                    ignoreFieldChange: true
                });

                let id = externalCustomerRecord.save();

                let confirmationForm = serverWidget.createForm({
                    title: 'Customer Created Externally'
                });

                confirmationForm.addField({
                    id: 'custpage_confirmation_page',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Confirmation'
                }).defaultValue = `
                    <div>
                        <p>Record Id: ${id}</p>
                        <p>Name: ${name}</p>
                        <p>Email: ${customerEmail}</p>
                        <p>Subject: ${subject}</p>
                        <p>Message: ${message}</p>
                    </div>
                `;

                scriptContext.response.writePage({
                    pageObject: confirmationForm
                });

                if(salesRep) {
                    email.send({
                        author: -5,
                        recipients: salesRep,
                        subject: 'External Customer Communication Record Created',
                        body: `Hi, 
                        Hope this mail finds you well. An External Customer Communication Record is created. The id of the created record is ${id}. 
                        Thank you`
                    });
                }

                email.send({
                    author: -5,
                    recipients: -5,
                    subject: 'External Customer Communication Record Created',
                    body: `Hi Larry, 
                    Hope this mail finds you well. An External Customer Communication Record is created. The id of the created record is ${id}. 
                    Thank you`
                });
                

            } catch(error) {
                log.error('Unexpected error occured while creating record', error.toString());
            }  
        }
    });